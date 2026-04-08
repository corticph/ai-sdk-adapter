// Adapter functions
export { buildParams } from './build-params.js';
export { toUIMessageStream } from './to-ui-message-stream.js';
export { convertA2AResponse } from './convert-a2a-response.js';

// All public types
export type {
  // Authentication
  ChatCredential,
  // UI Messages
  CortiUIMessage,
  CortiUIMessageChunk,
  CortiMessageMetadata,
  CortiMessageData,
  // Adapter Responses
  A2AMetadata,
  A2AResponse,
  // Stream Callbacks & Events
  A2AStreamEventData,
  StreamCallbacks,
  A2AStreamOptions,
} from './types.js';
