import { type Part, TaskState, type TaskStatus } from '@a2a-js/sdk';
import { Buffer } from 'node:buffer';
import type { Client } from '@a2a-js/sdk/client';

import { convertAsyncIteratorToReadableStream } from '@ai-sdk/provider-utils';
import type {
  A2AStreamEventData,
  ResponseMetadata,
  CortiUIMessageChunk,
  StreamConversionOptions,
} from './types.js';

const FINAL_STATES = new Set([
  TaskState.TASK_STATE_COMPLETED,
  TaskState.TASK_STATE_CANCELED,
  TaskState.TASK_STATE_FAILED,
  TaskState.TASK_STATE_REJECTED,
  TaskState.TASK_STATE_INPUT_REQUIRED,
  TaskState.TASK_STATE_AUTH_REQUIRED,
]);

const TASK_STATE_LABELS: Record<number, string> = {
  [TaskState.TASK_STATE_UNSPECIFIED]: 'unknown',
  [TaskState.TASK_STATE_SUBMITTED]: 'submitted',
  [TaskState.TASK_STATE_WORKING]: 'working',
  [TaskState.TASK_STATE_COMPLETED]: 'completed',
  [TaskState.TASK_STATE_FAILED]: 'failed',
  [TaskState.TASK_STATE_CANCELED]: 'canceled',
  [TaskState.TASK_STATE_INPUT_REQUIRED]: 'input-required',
  [TaskState.TASK_STATE_REJECTED]: 'rejected',
  [TaskState.TASK_STATE_AUTH_REQUIRED]: 'auth-required',
};

/**
 * Converts an A2A stream to a UI message stream compatible with the AI SDK.
 *
 * This function transforms the raw stream from `client.sendMessageStream()`
 * into a format that works with AI SDK UI components and the `useChat` hook.
 * It handles text streaming, file attachments, custom data events, and provides
 * lifecycle callbacks for monitoring stream progress.
 *
 * @param stream - AsyncIterable stream from `client.sendMessageStream()`
 * @param options - Optional configuration for stream conversion
 * @returns ReadableStream of UI message chunks
 *
 * @example
 * ```typescript
 * import { convertToParams, toUIMessageStream } from '@corti/ai-sdk-adapter';
 * import { ClientFactory } from '@a2a-js/sdk/client';
 * import { createUIMessageStreamResponse } from 'ai';
 *
 * // Build params and create stream
 * const factory = new ClientFactory();
 * const client = factory.createFromUrl("https://your.agent/agent-card.json");
 * const params = convertToParams(messages, credentials);
 * const a2aStream = client.sendMessageStream(params);
 *
 * // Convert to UI stream with options
 * const uiStream = toUIMessageStream(a2aStream, {
 *   callbacks: {
 *     onStart: () => console.log('Stream started'),
 *     onEvent: (event) => console.log('Event:', event),
 *     onFinish: (state) => console.log('Final state:', state),
 *     onError: (error) => console.error('Error:', error),
 *   },
 * });
 *
 * // Return as response
 * return createUIMessageStreamResponse({ stream: uiStream });
 * ```
 */
export function toUIMessageStream(
  stream: ReturnType<Client['sendMessageStream']>,
  options?: StreamConversionOptions,
): ReadableStream<CortiUIMessageChunk> {
  const { callbacks } = options ?? {};
  const activeTextIds = new Set<string>();
  let metadata: ResponseMetadata = {
    contextId: '',
    credits: 0,
    state: 'unknown',
    taskId: '',
  };
  let streamError: Error | undefined;
  let finishedState: TaskStatus | undefined;
  // Tracks whether the answer text has already been streamed via artifactUpdate events,
  // so we don't re-emit it if a final statusUpdate also carries a full text message.
  let artifactTextStreamed = false;
  const streamedArtifactIds = new Set<string>();

  const enqueueTextParts = (
    controller: TransformStreamDefaultController<CortiUIMessageChunk>,
    parts: Part[],
    id: string,
    lastChunk: boolean,
  ) => {
    const textContentParts = parts.filter((part) => part.content?.$case === 'text');

    if (textContentParts.length > 0) {
      const textContent = textContentParts
        .map((part) => (part.content as { $case: 'text'; value: string }).value)
        .join(' ');

      if (!activeTextIds.has(id)) {
        activeTextIds.add(id);
        controller.enqueue({ id, type: 'text-start' });
      }

      if (textContent.length > 0) {
        controller.enqueue({
          delta: textContent,
          id,
          type: 'text-delta',
        });
      }

      if (lastChunk && activeTextIds.has(id)) {
        controller.enqueue({
          id,
          type: 'text-end',
        });
        activeTextIds.delete(id);
      }
    }
  };

  const enqueueNonTextParts = (
    controller: TransformStreamDefaultController<CortiUIMessageChunk>,
    parts: Part[],
  ) => {
    const nonTextContentParts = parts.filter((part) => part.content?.$case !== 'text');

    for (const part of nonTextContentParts) {
      if (part.content?.$case === 'raw') {
        const base64Data = Buffer.from(part.content.value).toString('base64');
        const dataUrl = `data:${part.mediaType};base64,${base64Data}`;
        controller.enqueue({
          mediaType: part.mediaType,
          type: 'file',
          url: dataUrl,
        });
      } else if (part.content?.$case === 'url') {
        controller.enqueue({
          mediaType: part.mediaType,
          type: 'file',
          url: part.content.value,
        });
      } else if (part.content?.$case === 'data') {
        controller.enqueue({
          data: part.content.value,
          type: 'data-json',
        });
      }
    }
  };

  const enqueueParts = (
    controller: TransformStreamDefaultController<CortiUIMessageChunk>,
    parts: Part[],
    id: string,
    lastChunk: boolean,
  ) => {
    enqueueNonTextParts(controller, parts);
    enqueueTextParts(controller, parts, id, lastChunk);
  };

  const transformedStream = convertAsyncIteratorToReadableStream(
    stream[Symbol.asyncIterator](),
  ).pipeThrough(
    new TransformStream<A2AStreamEventData, CortiUIMessageChunk>({
      async flush(controller) {
        for (const activeTextId of activeTextIds) {
          controller.enqueue({
            id: activeTextId,
            type: 'text-end',
          });

          activeTextIds.delete(activeTextId);
        }

        if (metadata.contextId || metadata.taskId) {
          controller.enqueue({
            messageMetadata: {
              contextId: metadata.contextId,
              taskId: metadata.taskId,
              credits: metadata.credits,
              state: metadata.state,
            },
            type: 'message-metadata',
          });
        }

        controller.enqueue({
          finishReason: streamError ? 'error' : 'stop',
          messageMetadata: {
            credits: metadata.credits,
          },
          type: 'finish',
        });

        callbacks?.onFinish?.(finishedState);
      },

      async start() {
        callbacks?.onStart?.();
      },

      async transform(event, controller) {
        callbacks?.onEvent?.(event);
        try {
          if (event.payload?.$case === 'statusUpdate') {
            const statusUpdate = event.payload.value;
            const status = statusUpdate.status;
            if (!status) return;

            const isFinal = FINAL_STATES.has(status.state);

            if (!isFinal) {
              const statusContent = {
                message: status.message?.parts
                  .filter((p) => p.content?.$case === 'text')
                  .map((p) => (p.content as { $case: 'text'; value: string }).value)
                  .join(' '),
                state: TASK_STATE_LABELS[status.state] ?? 'unknown',
              };

              controller.enqueue({
                data: statusContent,
                type: 'data-status-update',
              });
            }

            if (status.message && isFinal) {
              const finalParts = artifactTextStreamed
                ? status.message.parts.filter((part) => part.content?.$case !== 'text')
                : status.message.parts;

              enqueueParts(
                controller,
                finalParts,
                isFinal
                  ? status.message.messageId
                  : status.message.taskId || status.message.messageId,
                isFinal,
              );
            }

            if (isFinal) {
              metadata = {
                contextId: statusUpdate.contextId || '',
                credits:
                  typeof statusUpdate.metadata?.credits === 'number'
                    ? statusUpdate.metadata.credits
                    : 0,
                state: TASK_STATE_LABELS[status.state] ?? 'unknown',
                taskId: statusUpdate.taskId || '',
              };

              finishedState = status;
            }
          } else if (event.payload?.$case === 'artifactUpdate') {
            const artifactUpdate = event.payload.value;
            if (!artifactUpdate.artifact) return;

            const artifactId = artifactUpdate.artifact.artifactId;
            if (streamedArtifactIds.has(artifactId) && !artifactUpdate.append) return;
            streamedArtifactIds.add(artifactId);

            const artifactParts = artifactUpdate.artifact.parts.filter(
              (part) => part.content?.$case === 'data' || part.content?.$case === 'text',
            );

            if (artifactParts.some((part) => part.content?.$case === 'text')) {
              artifactTextStreamed = true;
            }

            enqueueParts(controller, artifactParts, artifactId, artifactUpdate.lastChunk || false);
          }
        } catch (error) {
          streamError = error instanceof Error ? error : new Error(String(error));
          callbacks?.onError?.(streamError);
          controller.error(streamError);
        }
      },
    }),
  );

  return transformedStream;
}
