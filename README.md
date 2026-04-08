# @corti/ai-sdk-adapter

Corti AI SDK adapter for [Vercel AI SDK](https://sdk.vercel.ai/docs), integrating with Corti's A2A (Agent-to-Agent) API.

## Installation

```bash
npm install @corti/ai-sdk-adapter
```

## Usage

### Basic Chat Model

```typescript
import { corti } from '@corti/ai-sdk-adapter';
import { generateText } from 'ai';

const result = await generateText({
  model: corti('https://agent-card-url.com'),
  prompt: 'What is the weather today?',
});

console.log(result.text);
```

### Streaming

```typescript
import { corti } from '@corti/ai-sdk-adapter';
import { streamText } from 'ai';

const result = await streamText({
  model: corti('https://agent-card-url.com'),
  prompt: 'Tell me a story',
});

for await (const textPart of result.textStream) {
  process.stdout.write(textPart);
}
```

### With Configuration

```typescript
import { corti } from '@corti/ai-sdk-adapter';
import { generateText } from 'ai';

const result = await generateText({
  model: corti('https://agent-card-url.com', {
    credentials: [
      {
        mcp_name: 'example-server',
        token: 'your-token',
        type: 'bearer',
      },
    ],
  }),
  prompt: 'Query requiring credentials',
});
```

### Using Provider Options

The Corti provider supports A2A-specific options via `providerOptions`:

```typescript
import { corti } from '@corti/ai-sdk-adapter';
import { generateText } from 'ai';

const result = await generateText({
  model: corti('https://agent-card-url.com'),
  prompt: 'Continue our conversation',
  providerOptions: {
    a2a: {
      contextId: 'existing-context-id',
      taskId: 'existing-task-id',
    },
  },
});

// Access A2A metadata in the response
console.log(result.providerMetadata.a2a.contextId);
console.log(result.providerMetadata.a2a.taskId);
console.log(result.providerMetadata.a2a.credits);
```

### Custom CortiUIMessage Type

The provider exports a custom `CortiUIMessage` type that extends the standard `UIMessage` with A2A-specific metadata and data parts:

```typescript
import type { CortiUIMessage } from '@corti/ai-sdk-adapter';

// CortiUIMessage includes:
// - metadata: contextId, taskId, history, credits
// - custom data parts: text with name, json with name/content, status-update
```

## Configuration Options

### ChatConfig

```typescript
interface ChatConfig {
  // Provider identifier (default: 'corti')
  provider?: string;

  // Custom ID generator for messages
  generateId?: IdGenerator;

  // A2A client options
  clientOptions?: A2AClientOptions;

  // Credentials for MCP servers
  credentials?: ChatCredential[];
}
```

### ChatCredential

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

## Runtime Support

This package supports:

- Node.js (18+)
- Edge runtimes (Vercel Edge, Cloudflare Workers)

## API Reference

### `corti(modelId: string, config?: ChatConfig)`

Creates a Corti language model instance.

**Parameters:**

- `modelId`: Agent card URL
- `config`: Optional configuration

**Returns:** `LanguageModelV3` instance

### `createCorti()`

Creates a Corti provider factory function.

**Returns:** `CortiProvider` instance

## Troubleshooting

### A2A Connection Issues

If you encounter connection issues with the A2A API:

1. Verify the agent card URL is accessible
2. Check that credentials are properly configured
3. Ensure network access to the A2A endpoint

### Context and Task IDs

- `contextId`: Used to maintain conversation context across multiple messages
- `taskId`: Used to continue an existing task (e.g., for multi-turn interactions)
- Credentials are only sent on the first message (when no `taskId` is provided)

### Tool Support

Currently, the provider does not support AI SDK tools. Tool calls will result in an `UnsupportedFunctionalityError`.

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or pull request on GitHub.

## Links

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [A2A SDK Documentation](https://github.com/corticph/a2a-js)
