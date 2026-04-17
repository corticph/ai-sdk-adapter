import type { Message, MessageSendParams } from '@a2a-js/sdk';
import { toA2AMessages } from './helpers/to-a2a-messages.js';
import type { ExpertCredential, CortiUIMessage } from './types.js';

/**
 * Builds message send parameters for A2A client from Corti UI messages.
 *
 * Automatically infers contextId and taskId from the previous assistant message
 * in the conversation. The taskId is only included if the last assistant message
 * had a state of 'input-required', indicating the task is waiting for more input.
 * Credentials are only added on the first message (when no taskId is inferred).
 *
 * @param messages - Array of Corti UI messages (from useChat or similar)
 * @param credentials - Optional credentials for MCP servers
 * @returns Message send parameters for A2A client with inferred taskId/contextId
 *
 * @example
 * ```typescript
 * import { convertToParams } from '@corti/ai-sdk-adapter';
 * import { A2AClient } from '@a2a-js/sdk/client';
 *
 * // In a Next.js API route:
 * export async function POST(req: Request) {
 *   const { messages } = await req.json(); // CortiUIMessage[]
 *   const params = convertToParams(messages, credentials);
 *   const response = await client.sendMessage(params);
 *   // ...
 * }
 * ```
 */
export function convertToParams(
  messages: CortiUIMessage[],
  credentials?: ExpertCredential[],
): MessageSendParams {
  // Find the last assistant message from UI messages to extract metadata
  const lastAssistantUIMessage = [...messages].reverse().find((msg) => msg.role === 'assistant');

  // Convert UI messages to A2A format
  const a2aMessages = toA2AMessages(messages);

  // Create a copy of the last A2A message to avoid mutating the input array
  const lastMessage = a2aMessages[a2aMessages.length - 1];
  const message: Message = {
    ...lastMessage,
    parts: [...lastMessage.parts],
  };

  const sendParams: MessageSendParams = {
    message,
  };

  // Extract metadata from the last assistant UI message
  if (lastAssistantUIMessage?.metadata) {
    const metadata = lastAssistantUIMessage.metadata;

    // Always infer contextId from the last assistant message
    if (metadata.contextId) {
      sendParams.message.contextId = metadata.contextId;
    }

    // Only infer taskId if the last assistant message state was 'input-required'
    // This means the task is waiting for more input and should be continued
    if (metadata.state === 'input-required' && metadata.taskId) {
      sendParams.message.taskId = metadata.taskId;
    }
  }

  // Only send credentials on first message (when no taskId is present)
  if (!sendParams.message.taskId && credentials) {
    for (const credential of credentials) {
      switch (credential.type) {
        case 'bearer':
          message.parts.push({
            data: {
              mcp_name: credential.mcp_name,
              token: credential.token,
              type: 'token',
            },
            kind: 'data',
          });
          break;
        case 'oauth2.0':
          message.parts.push({
            data: {
              client_id: credential.client_id,
              client_secret: credential.client_secret,
              mcp_name: credential.mcp_name,
              type: 'credentials',
            },
            kind: 'data',
          });
          break;
        default:
          throw new Error('Unknown credential type');
      }
    }
  }

  return sendParams;
}
