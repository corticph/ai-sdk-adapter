import { Buffer } from 'node:buffer';
import type { Message, Part, Task } from '@a2a-js/sdk';
import type { A2AMetadata, A2AResponse } from './types.js';

/**
 * Converts an A2A response (Task or Message) to a structured format
 * suitable for non-streaming use cases.
 *
 * This function extracts message content and metadata from A2A responses,
 * making it easy to work with non-streaming AI SDK patterns or custom
 * implementations.
 *
 * @param response - A2A task or message response from `client.sendMessage()`
 * @returns Structured response with content and metadata
 *
 * @example
 * ```typescript
 * import { buildParams, convertA2AResponse } from '@corti/ai-sdk-adapter';
 * import { A2AClient } from '@a2a-js/sdk/client';
 *
 * const params = buildParams(messages); // CortiUIMessage[]
 * const client = await A2AClient.fromCardUrl(agentUrl);
 * const rawResponse = await client.sendMessage(params);
 *
 * if (!rawResponse.error) {
 *   const response = convertA2AResponse(rawResponse.result);
 *   console.log('Content:', response.content);
 *   console.log('Metadata:', response.metadata);
 * }
 * ```
 */
export function convertA2AResponse(response: Task | Message): A2AResponse {
  const content: A2AResponse['content'] = [];
  let metadata: A2AMetadata = {
    contextId: '',
    credits: 0,
    state: 'unknown',
    taskId: '',
  };

  if (response.kind === 'message') {
    for (const part of response.parts) {
      content.push(...convertPartToContent(part));
    }

    metadata = {
      contextId: response.contextId?.toString() || '',
      credits: typeof response.metadata?.credits === 'number' ? response.metadata.credits : 0,
      state: 'completed',
      taskId: response.taskId?.toString() || '',
    };
  }

  if (response.kind === 'task') {
    // Extract message content from task status
    if (response.status.message) {
      for (const part of response.status.message.parts) {
        content.push(...convertPartToContent(part));
      }
    }

    // Extract artifact content
    if (response.artifacts) {
      for (const artifact of response.artifacts) {
        for (const part of artifact.parts) {
          content.push(...convertArtifactPartToContent(part));
        }
      }
    }

    metadata = {
      contextId: response.contextId?.toString() || '',
      credits: typeof response.metadata?.credits === 'number' ? response.metadata.credits : 0,
      state: response.status.state,
      taskId: response.id?.toString() || '',
    };
  }

  return {
    content,
    metadata,
  };
}

/**
 * Converts A2A message part to content format.
 */
function convertPartToContent(part: Part): A2AResponse['content'] {
  const content: A2AResponse['content'] = [];

  if (part.kind === 'text') {
    content.push({
      text: part.text,
      type: 'text',
    });
  }

  return content;
}

/**
 * Converts A2A artifact part to content format.
 */
function convertArtifactPartToContent(part: Part): A2AResponse['content'] {
  const content: A2AResponse['content'] = [];

  if (part.kind === 'file') {
    if ('bytes' in part.file) {
      content.push({
        data: Uint8Array.from(Buffer.from(part.file.bytes, 'base64')),
        mediaType: part.file.mimeType as string,
        type: 'file',
      });
    } else if ('uri' in part.file) {
      content.push({
        data: part.file.uri as string,
        mediaType: part.file.mimeType as string,
        type: 'file',
      });
    }
  }

  if (part.kind === 'data') {
    // Convert JSON data to file format for consistency
    content.push({
      data: Buffer.from(JSON.stringify(part.data)).toString('base64'),
      mediaType: 'application/json',
      type: 'file',
    });
  }

  return content;
}
