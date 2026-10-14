# @corti/ai-sdk-adapter

Adapter for integrating Corti's A2A (Agent-to-Agent) API with [Vercel AI SDK](https://sdk.vercel.ai/docs). This package provides utilities to convert between AI SDK's UI message format and Corti's A2A format.

## Installation

```bash
npm install @corti/ai-sdk-adapter @corti/sdk @a2a-js/sdk ai
```

## Overview

This adapter provides three main functions:

- **`convertToParams()`** - Converts `CortiUIMessage[]` to A2A `MessageSendParams`
- **`toUIMessageStream()`** - Converts A2A stream to UI message stream
- **`createA2AClientFactory()`** - Creates an A2A client factory configured with Corti authentication

## Usage

### Streaming Chat (Next.js API Route)

```typescript
import { convertToParams, toUIMessageStream, createA2AClientFactory } from '@corti/ai-sdk-adapter';
import type { CortiUIMessage, ExpertCredential } from '@corti/ai-sdk-adapter';
import { CortiClient } from '@corti/lib';
import { createUIMessageStreamResponse } from 'ai';

export async function POST(req: Request) {
  const { messages }: { messages: CortiUIMessage[] } = await req.json();

  // Optional: Define credentials for MCP servers
  const credentials: ExpertCredential[] = [
    {
      mcp_name: 'my-server',
      token: process.env.MCP_TOKEN,
      type: 'bearer' as const,
    },
  ];

  // Build A2A params from UI messages
  const params = convertToParams(messages, credentials);

  // Create A2A client factory and send message stream
  const corti = new CortiClient({ /* ... */ });
  const factory = createA2AClientFactory(corti);
  const agentUrl = await corti.agents.getCardUrl("your-agent-id");
  const client = factory.createFromUrl(agentUrl.toString(), '');
  const a2aStream = client.sendMessageStream(params);

  // Convert to UI stream with optional callbacks
  const uiStream = toUIMessageStream(a2aStream, {
    callbacks: {
      onStart: () => console.log('Stream started'),
      onEvent: () => [],
      onFinish: () => console.log('Stream finished'),
      onError: (error) => console.error('Error:', error),
    },
  });

  return createUIMessageStreamResponse({ stream: uiStream });
}
```

### Client-Side (React with useChat)

```typescript
import { useState } from 'react';
import { useChat } from 'ai/react';
import type { CortiUIMessage } from '@corti/ai-sdk-adapter';

export default function Chat() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat<CortiUIMessage>({
    api: '/api/chat',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status === "streaming" || status === "submitted") return;
    sendMessage({ message: input });
    setInput('');
  };

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          <strong>{m.role}:</strong>{' '}
          {m.parts.map(p => p.type === 'text' ? p.text : '').join(' ')}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

## Types

### CortiUIMessage

Custom UI message type that extends the standard `UIMessage` with A2A-specific metadata and data parts:

```typescript
import type { CortiUIMessage } from '@corti/ai-sdk-adapter';

// CortiUIMessage includes:
// - metadata: contextId, taskId, history, credits, state
// - custom data parts: text with name, json with name/content, status-update
```

### ExpertCredential

Credentials for authenticating with MCP servers:

```typescript
type ExpertCredential =
  | {
      mcp_name: string;
      token: string;
      type: 'bearer';
    }
  | {
      mcp_name: string;
      client_id: string;
      client_secret: string;
      type: 'oauth2.0';
    };
```

## How It Works

### Context and Task Continuity

The adapter automatically manages conversation context and task continuity:

- **`contextId`**: Maintains conversation context across multiple messages. Automatically inferred from the last assistant message.
- **`taskId`**: Continues an existing task when the agent requires more input. Only included when the last assistant message has `state: 'input-required'`.
- **Credentials**: Only sent on the first message (when no `taskId` is present).

The `convertToParams()` function handles all of this automatically - you just pass the messages array from `useChat`.

### Stream Callbacks

The `toUIMessageStream()` function accepts a `StreamConversionOptions` object with optional callbacks to monitor stream progress:

```typescript
const uiStream = toUIMessageStream(a2aStream, {
  callbacks: {
    onStart: () => {
      // Called when streaming begins
    },
    onEvent: (event) => {
      if (event.payload?.$case !== 'statusUpdate') return;
      return [{
        type: 'data-agent-state',
        data: { state: event.payload.value.status?.state ?? null },
        transient: true,
      }];
    },
    onFinish: (state) => {
      // Called when stream completes with the final task status
    },
    onError: (error: Error) => {
      // Called if an error occurs during streaming
    },
  },
});
```

`onEvent` may return an array of `CustomDataChunk` values, nothing, or a promise of either.
Only `data-*` chunks are allowed; the adapter retains control of text, metadata, and
completion. Chunks require a nonempty suffix after `data-` and a `data` property;
optional `id` and `transient` fields must be a string and boolean, respectively.
Invalid entries are skipped individually with a payload-free warning. Non-array
output is also discarded with a warning, without interrupting built-in conversion.

The callback is awaited before converting the current event or processing later
events. Returned chunks appear before the event's built-in chunks, in array order.
Slow callbacks delay text and completion; a promise that never settles stalls
processing. Async I/O does not block the JavaScript thread, but synchronous CPU work
does. Callback throws and rejected promises invoke `onError` and error the stream
without a successful `onFinish`.

Canceling the UI stream discards any pending callback's eventual output or rejection.
It does not abort the callback's external I/O; callers must provide their own abort
signals and timeouts. `onFinish` is not called for cancellation.

**Breaking change:** `onEvent` return values are no longer ignored, and async
callbacks are now awaited. Observer-only callbacks should return nothing rather
than incidental values such as the result of `array.push()`. Explicit `void` or
`Promise<void>` return annotations must be updated to `undefined` or
`Promise<undefined>`, respectively, or removed to allow inference.

## Runtime Support

This package supports:

- Node.js (18+)
- Edge runtimes (Vercel Edge, Cloudflare Workers)

## Limitations

- **No tool support**: This adapter does not currently support AI SDK tools/function calling
- **A2A-specific**: Only works with Corti's A2A agents, not general LLM providers

## License

MIT

## Links

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [A2A SDK Documentation](https://github.com/corticph/a2a-js)
