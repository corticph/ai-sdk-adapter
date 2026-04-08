# @corti/ai-sdk-adapter

Adapter for integrating Corti's A2A (Agent-to-Agent) API with [Vercel AI SDK](https://sdk.vercel.ai/docs). This package provides utilities to convert between AI SDK's UI message format and Corti's A2A format.

## Installation

```bash
npm install @corti/ai-sdk-adapter @a2a-js/sdk ai
```

## Overview

This adapter provides three main functions:

- **`buildParams()`** - Converts `CortiUIMessage[]` to A2A `MessageSendParams`
- **`toUIMessageStream()`** - Converts A2A stream to UI message stream
- **`convertA2AResponse()`** - Converts A2A response for non-streaming use

## Usage

### Streaming Chat (Next.js API Route)

```typescript
import { buildParams, toUIMessageStream } from '@corti/ai-sdk-adapter';
import type { CortiUIMessage } from '@corti/ai-sdk-adapter';
import { A2AClient } from '@a2a-js/sdk/client';
import { createUIMessageStreamResponse } from 'ai';

export async function POST(req: Request) {
  const { messages }: { messages: CortiUIMessage[] } = await req.json();
  
  // Optional: Define credentials for MCP servers
  const credentials = [
    {
      mcp_name: 'my-server',
      token: process.env.MCP_TOKEN,
      type: 'bearer' as const,
    },
  ];
  
  // Build A2A params from UI messages
  const params = buildParams(messages, credentials);
  
  // Create A2A client and send message
  const client = await A2AClient.fromCardUrl('https://agent-card-url.com');
  const a2aStream = client.sendMessageStream(params);
  
  // Convert to UI stream with optional callbacks
  const uiStream = toUIMessageStream(a2aStream, {
    onStart: () => console.log('Stream started'),
    onToken: (token) => console.log('Token:', token),
    onFinish: (state) => console.log('Final state:', state),
    onError: (error) => console.error('Error:', error),
  });
  
  return createUIMessageStreamResponse({ stream: uiStream });
}
```

### Client-Side (React with useChat)

```typescript
'use client';

import { useChat } from 'ai/react';
import type { CortiUIMessage } from '@corti/ai-sdk-adapter';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat<CortiUIMessage>({
    api: '/api/chat',
  });

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          <strong>{m.role}:</strong>{' '}
          {m.parts.map(p => p.type === 'text' ? p.text : '').join(' ')}
          {m.metadata?.credits && (
            <div>Credits used: {m.metadata.credits}</div>
          )}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

### Non-Streaming Example

```typescript
import { buildParams, convertA2AResponse } from '@corti/ai-sdk-adapter';
import type { CortiUIMessage } from '@corti/ai-sdk-adapter';
import { A2AClient } from '@a2a-js/sdk/client';

const messages: CortiUIMessage[] = [
  { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
];

const params = buildParams(messages);
const client = await A2AClient.fromCardUrl('https://agent-card-url.com');
const rawResponse = await client.sendMessage(params);

if (!rawResponse.error) {
  const response = convertA2AResponse(rawResponse.result);
  console.log('Content:', response.content);
  console.log('Metadata:', response.metadata);
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

### ChatCredential

Credentials for authenticating with MCP servers:

```typescript
type ChatCredential =
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

The `buildParams()` function handles all of this automatically - you just pass the messages array from `useChat`.

### Stream Callbacks

The `toUIMessageStream()` function supports optional callbacks to monitor stream progress:

```typescript
const uiStream = toUIMessageStream(a2aStream, {
  onStart: () => {
    // Called when streaming begins
  },
  onToken: (token: string) => {
    // Called for each text token received
  },
  onFinish: (state: string) => {
    // Called when stream completes with final task state
  },
  onError: (error: Error) => {
    // Called if an error occurs during streaming
  },
});
```

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
