// Adapter functions
export { convertToParams } from './convert-to-params.js';
export { toUIMessageStream } from './to-ui-message-stream.js';
export { createA2AClientFactory, createFetchImplementation } from './create-client-factory.js';

export type {
  ExpertCredential,
  CortiUIMessage,
  CortiUIMessageChunk,
  CortiMessageMetadata,
  CortiUIDataTypes,
  CortiTextPart,
  CortiJSONPart,
  CortiStatusUpdate,
  ResponseMetadata,
  StreamCallbacks,
  StreamConversionOptions,
} from './types.js';
