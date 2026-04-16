import { Buffer } from 'node:buffer';
import type { DataPart, FilePart, Message, TextPart } from '@a2a-js/sdk';
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
      const parts: (TextPart | FilePart | DataPart)[] = [];

      // Process message parts
      if (message.parts && Array.isArray(message.parts)) {
        for (const part of message.parts) {
          part.type;
          if (part.type === 'text') {
            parts.push({ kind: 'text', text: part.text } as TextPart);
          } else if (part.type === 'file') {
            parts.push(convertFileToProviderPart(part));
          } else if (part.type === 'data-text') {
            parts.push({
              kind: 'text',
              text: part.data as CortiTextPart,
            } as TextPart);
          } else if (part.type === 'data-json') {
            parts.push({
              kind: 'data',
              data: part.data as CortiJSONPart,
            } as DataPart);
          }

          // Skip other part types (tool-call, tool-result, image, etc.) as they're not supported in A2A messages
        }
      }

      return {
        kind: 'message' as const,
        messageId: generateId(),
        parts,
        role: message.role === 'assistant' ? ('agent' as const) : ('user' as const),
      };
    });
}

/**
 * Converts Corti UI file part to A2A file or data part.
 */
function convertFileToProviderPart(
  part: Extract<CortiUIMessage['parts'][number], { type: 'file' }>,
): FilePart | DataPart {
  const url = part.url;

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return {
      file: {
        mimeType: part.mediaType,
        name: 'file',
        uri: url,
      },
      kind: 'file',
    };
  }

  if (part.mediaType === 'application/json' && url.startsWith('data:application/json;base64,')) {
    const base64Data = url.replace('data:application/json;base64,', '');
    return {
      data: JSON.parse(Buffer.from(base64Data, 'base64').toString('utf-8')),
      kind: 'data',
    };
  }

  // Data URL with base64 content
  const matches = url.match(/^data:([^;]+);base64,(.+)$/);
  if (matches) {
    const [, , base64Data] = matches;
    return {
      file: {
        bytes: base64Data,
        mimeType: part.mediaType,
        name: 'file',
      },
      kind: 'file',
    };
  }

  throw new Error(`Unsupported file URL format: ${url}`);
}
