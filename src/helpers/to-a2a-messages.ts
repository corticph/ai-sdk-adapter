import { Buffer } from 'node:buffer';
import { type Message, type Part, Role } from '@a2a-js/sdk';
import { generateId as defaultGenerateId } from '@ai-sdk/provider-utils';
import type { CortiJSONPart, CortiTextPart, CortiUIMessage } from '../types.js';

/**
 * Converts Corti UI messages to A2A Message format.
 * Handles custom data types (data-text, data-json) in addition to standard message parts.
 *
 * @internal This is an internal utility function used by `convertToParams()`.
 *
 * @param uiMessages - Array of Corti UI messages from `useChat` or similar hooks
 * @param options - Optional configuration
 * @param options.generateId - Custom ID generator function
 * @returns Array of A2A messages
 */
export function toA2AMessages(
  uiMessages: CortiUIMessage[],
  options: { generateId?: () => string } = {},
): Message[] {
  const generateId = options.generateId || defaultGenerateId;

  return uiMessages
    .filter((message) => message.role === 'assistant' || message.role === 'user')
    .map((message) => {
      const parts: Part[] = [];

      if (message.parts && Array.isArray(message.parts)) {
        for (const part of message.parts) {
          if (part.type === 'text') {
            parts.push({
              content: { $case: 'text', value: part.text },
              metadata: undefined,
              filename: '',
              mediaType: 'text/plain',
            });
          } else if (part.type === 'file') {
            parts.push(convertFileToProviderPart(part));
          } else if (part.type === 'data-text') {
            parts.push({
              content: { $case: 'text', value: part.data as CortiTextPart },
              metadata: undefined,
              filename: '',
              mediaType: 'text/plain',
            });
          } else if (part.type === 'data-json') {
            parts.push({
              content: { $case: 'data', value: part.data as CortiJSONPart },
              metadata: undefined,
              filename: '',
              mediaType: '',
            });
          }
        }
      }

      return {
        messageId: generateId(),
        parts,
        role: message.role === 'assistant' ? Role.ROLE_AGENT : Role.ROLE_USER,
        contextId: '',
        taskId: '',
        metadata: undefined,
        extensions: [],
        referenceTaskIds: [],
      } satisfies Message;
    });
}

/**
 * Converts Corti UI file part to A2A file or data part.
 */
function convertFileToProviderPart(
  part: Extract<CortiUIMessage['parts'][number], { type: 'file' }>,
): Part {
  const url = part.url;

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return {
      content: { $case: 'url', value: url },
      metadata: undefined,
      filename: 'file',
      mediaType: part.mediaType,
    };
  }

  if (part.mediaType === 'application/json' && url.startsWith('data:application/json;base64,')) {
    const base64Data = url.replace('data:application/json;base64,', '');
    return {
      content: {
        $case: 'data',
        value: JSON.parse(Buffer.from(base64Data, 'base64').toString('utf-8')),
      },
      metadata: undefined,
      filename: '',
      mediaType: 'application/json',
    };
  }

  // Data URL with base64 content
  const matches = url.match(/^data:([^;]+);base64,(.+)$/);
  if (matches) {
    const [, , base64Data] = matches;
    return {
      content: { $case: 'raw', value: Buffer.from(base64Data, 'base64') },
      metadata: undefined,
      filename: 'file',
      mediaType: part.mediaType,
    };
  }

  throw new Error(`Unsupported file URL format: ${url}`);
}
