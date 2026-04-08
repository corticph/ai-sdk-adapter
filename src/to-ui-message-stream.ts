import type { Part } from '@a2a-js/sdk';
import { convertAsyncIteratorToReadableStream } from '@ai-sdk/provider-utils';
import type {
  A2AMetadata,
  A2AStreamEventData,
  CortiUIMessageChunk,
  StreamCallbacks,
} from './types.js';

/**
 * Converts an A2A stream to a UI message stream compatible with the AI SDK.
 *
 * This function transforms the raw stream from `client.sendMessageStream()`
 * into a format that works with AI SDK UI components and the `useChat` hook.
 * It handles text streaming, file attachments, custom data events, and provides
 * lifecycle callbacks for monitoring stream progress.
 *
 * @param stream - AsyncIterable stream from `client.sendMessageStream()`
 * @param callbacks - Optional lifecycle callbacks for stream events
 * @returns ReadableStream of UI message chunks
 *
 * @example
 * ```typescript
 * import { buildParams, toUIMessageStream } from '@corti/ai-sdk-adapter';
 * import { A2AClient } from '@a2a-js/sdk/client';
 * import { createUIMessageStreamResponse } from 'ai';
 *
 * // Build params and create stream
 * const params = buildParams(messages, credentials); // CortiUIMessage[]
 * const client = await A2AClient.fromCardUrl(agentUrl);
 * const a2aStream = client.sendMessageStream(params);
 *
 * // Convert to UI stream with callbacks
 * const uiStream = toUIMessageStream(a2aStream, {
 *   onStart: () => console.log('Stream started'),
 *   onToken: (token) => console.log('Token:', token),
 *   onFinish: (state) => console.log('Final state:', state),
 *   onError: (error) => console.error('Error:', error),
 * });
 *
 * // Return as response
 * return createUIMessageStreamResponse({ stream: uiStream });
 * ```
 */
export function toUIMessageStream(
  stream: AsyncIterable<A2AStreamEventData>,
  callbacks?: StreamCallbacks,
): ReadableStream<CortiUIMessageChunk> {
  const activeTextIds = new Set<string>();
  const textBuffer: string[] = [];
  let metadata: A2AMetadata = {
    contextId: '',
    credits: 0,
    state: 'unknown',
    taskId: '',
  };
  const streamAborted = false;
  let streamError: Error | undefined;

  /**
   * Helper to safely invoke callbacks
   */
  const safeCallback = async (fn: (() => void | Promise<void>) | undefined) => {
    if (fn) {
      try {
        await fn();
      } catch (error) {
        console.error('Callback error:', error);
      }
    }
  };

  /**
   * Enqueues text parts with proper start/delta/end events.
   */
  const enqueueTextParts = (
    controller: TransformStreamDefaultController<CortiUIMessageChunk>,
    parts: Part[],
    id: string,
    lastChunk: boolean,
  ) => {
    const textContentParts = parts.filter((part) => part.kind === 'text');

    if (textContentParts.length > 0) {
      const textContent = textContentParts.map((part) => part.text).join(' ');

      // Track active text streams
      if (!activeTextIds.has(id)) {
        activeTextIds.add(id);
        controller.enqueue({ id, type: 'text-start' });
      }

      // Enqueue text delta
      controller.enqueue({
        delta: textContent,
        id,
        type: 'text-delta',
      });

      // Track for callbacks
      textBuffer.push(textContent);
      safeCallback(callbacks?.onToken?.bind(null, textContent));
      safeCallback(callbacks?.onText?.bind(null, textContent));

      if (lastChunk && activeTextIds.has(id)) {
        controller.enqueue({
          id,
          type: 'text-end',
        });
        activeTextIds.delete(id);
      }
    }
  };

  /**
   * Enqueues non-text parts (files and data).
   */
  const enqueueNonTextParts = (
    controller: TransformStreamDefaultController<CortiUIMessageChunk>,
    parts: Part[],
  ) => {
    const nonTextContentParts = parts.filter((part) => part.kind !== 'text');

    for (const part of nonTextContentParts) {
      if (part.kind === 'file') {
        if ('bytes' in part.file) {
          const base64Data = part.file.bytes;
          const dataUrl = `data:${part.file.mimeType};base64,${base64Data}`;

          controller.enqueue({
            mediaType: part.file.mimeType as string,
            type: 'file',
            url: dataUrl,
          });
        }
        if ('uri' in part.file) {
          controller.enqueue({
            mediaType: part.file.mimeType as string,
            type: 'file',
            url: part.file.uri as string,
          });
        }
      }

      if (part.kind === 'data') {
        // Emit as custom data-json event
        controller.enqueue({
          data: {
            content: part.data,
            name: 'data-part',
          },
          type: 'data-json',
        } as CortiUIMessageChunk);
      }
    }
  };

  /**
   * Enqueues all parts (text and non-text).
   */
  const enqueueParts = (
    controller: TransformStreamDefaultController<CortiUIMessageChunk>,
    parts: Part[],
    id: string,
    lastChunk: boolean,
  ) => {
    enqueueNonTextParts(controller, parts);
    enqueueTextParts(controller, parts, id, lastChunk);
  };

  // Convert async iterator to readable stream and apply transformations
  const transformedStream = convertAsyncIteratorToReadableStream(
    stream[Symbol.asyncIterator](),
  ).pipeThrough(
    new TransformStream<A2AStreamEventData, CortiUIMessageChunk>({
      async flush(controller) {
        // Close any open text streams
        for (const activeTextId of activeTextIds) {
          activeTextIds.delete(activeTextId);
        }

        const finalText = textBuffer.join('');

        // Emit final metadata as message metadata
        if (metadata.contextId || metadata.taskId) {
          controller.enqueue({
            messageMetadata: {
              contextId: metadata.contextId,
              credits: metadata.credits,
              state: metadata.state,
            },
            type: 'message-metadata',
          } as CortiUIMessageChunk);
        }

        // Emit finish event
        controller.enqueue({
          finishReason: streamError ? 'error' : streamAborted ? 'abort' : 'stop',
          type: 'finish',
        } as CortiUIMessageChunk);

        // Call final callbacks
        await safeCallback(callbacks?.onFinal?.bind(null, finalText));

        if (streamError) {
          await safeCallback(callbacks?.onError?.bind(null, streamError));
        } else if (streamAborted) {
          await safeCallback(callbacks?.onAbort);
        } else {
          await safeCallback(callbacks?.onFinish?.bind(null, undefined));
        }
      },

      async start() {
        await safeCallback(callbacks?.onStart);
      },

      async transform(event, controller) {
        console.log(event);
        try {
          // Process different event types
          if (event.kind === 'status-update') {
            // Emit status updates as custom data events (except final ones)
            if (!event.final) {
              const statusContent = {
                message: event.status.message?.parts
                  .filter((p) => p.kind === 'text')
                  .map((p) => p.text)
                  .join(' '),
                state: event.status.state,
              };

              controller.enqueue({
                data: statusContent,
                type: 'data-status-update',
              } as CortiUIMessageChunk);
            }

            // Enqueue message parts from status
            if (event.status.message && event.final) {
              enqueueParts(
                controller,
                event.status.message.parts,
                event.final
                  ? event.status.message.messageId
                  : (event.status.message.taskId ?? event.status.message.messageId),
                event.final || false,
              );
            }

            // Update metadata on final status
            if (event.final) {
              metadata = {
                contextId: event.contextId?.toString() || '',
                credits: typeof event.metadata?.credits === 'number' ? event.metadata.credits : 0,
                state: event.status.state,
                taskId: event.taskId?.toString() || '',
              };
            }
          } else if (event.kind === 'artifact-update') {
            // Enqueue artifact parts (mainly data parts)
            enqueueParts(
              controller,
              event.artifact.parts.filter((part) => part.kind === 'data'),
              event.artifact.artifactId,
              event.lastChunk || false,
            );
          }
        } catch (error) {
          streamError = error instanceof Error ? error : new Error(String(error));
          controller.error(streamError);
        }
      },
    }),
  );

  return transformedStream;
}
