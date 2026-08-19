import { type StreamResponse, TaskState, Role } from '@a2a-js/sdk';
import { describe, expect, it, vi } from 'vitest';
import { toUIMessageStream } from '../to-ui-message-stream.js';
import type { CortiUIMessageChunk, StreamCallbacks } from '../types.js';
import {
  mockStatusUpdateEvent,
  mockNonFinalStatusUpdate,
  mockSubmittedStatusUpdate,
  mockInputRequiredStatusUpdate,
  mockArtifactUpdateEvent,
  mockArtifactUpdateFirstChunk,
  mockArtifactUpdateMiddleChunk,
  mockArtifactUpdateLastChunk,
  mockArtifactWithFile,
  mockArtifactWithFileUri,
} from '../__fixtures__/mock-responses.js';

async function* createMockStream(
  events: StreamResponse[],
): AsyncGenerator<StreamResponse, void, undefined> {
  for (const event of events) {
    yield event;
  }
}

async function collectChunks(
  stream: ReadableStream<CortiUIMessageChunk>,
): Promise<CortiUIMessageChunk[]> {
  const chunks: CortiUIMessageChunk[] = [];
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return chunks;
}

describe('toUIMessageStream', () => {
  describe('status-update events', () => {
    it('should handle final status update event', async () => {
      const stream = createMockStream([mockStatusUpdateEvent]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      expect(chunks.length).toBeGreaterThanOrEqual(4);

      const textStartChunk = chunks.find((c) => c.type === 'text-start');
      const textDeltaChunk = chunks.find((c) => c.type === 'text-delta');
      const textEndChunk = chunks.find((c) => c.type === 'text-end');
      const metadataChunk = chunks.find((c) => c.type === 'message-metadata');
      const finishChunk = chunks.find((c) => c.type === 'finish');

      expect(textStartChunk).toBeDefined();
      expect(textDeltaChunk).toBeDefined();
      expect(textDeltaChunk?.type === 'text-delta' && textDeltaChunk.delta).toBe(
        'Final status message.',
      );
      expect(textEndChunk).toBeDefined();
      expect(metadataChunk).toBeDefined();
      expect(
        metadataChunk?.type === 'message-metadata' && metadataChunk.messageMetadata,
      ).toMatchObject({
        contextId: 'ctx-456',
        state: 'completed',
        credits: 5,
      });
      expect(finishChunk).toBeDefined();
      expect(finishChunk?.type === 'finish' && finishChunk.finishReason).toBe('stop');
      expect(finishChunk?.type === 'finish' && finishChunk.messageMetadata).toMatchObject({
        credits: 5,
      });
    });

    it('should handle non-final status update as data-status-update', async () => {
      const stream = createMockStream([mockNonFinalStatusUpdate, mockStatusUpdateEvent]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      const statusUpdateChunk = chunks.find((c) => c.type === 'data-status-update');
      expect(statusUpdateChunk).toBeDefined();
      expect(
        statusUpdateChunk?.type === 'data-status-update' && statusUpdateChunk.data,
      ).toMatchObject({
        state: 'working',
        message: 'Processing your request...',
      });
    });

    it('should handle submitted status without message', async () => {
      const stream = createMockStream([mockSubmittedStatusUpdate, mockStatusUpdateEvent]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      const finishChunk = chunks.find((c) => c.type === 'finish');
      expect(finishChunk).toBeDefined();
    });

    it('should handle input-required state as final', async () => {
      const stream = createMockStream([mockInputRequiredStatusUpdate]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      // input-required is a terminal state (agent waits for user input)
      const metadataChunk = chunks.find((c) => c.type === 'message-metadata');
      expect(metadataChunk).toBeDefined();
      expect(
        metadataChunk?.type === 'message-metadata' && metadataChunk.messageMetadata.state,
      ).toBe('input-required');
    });

    it('should extract metadata from final status update', async () => {
      const stream = createMockStream([mockStatusUpdateEvent]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      const metadataChunk = chunks.find((c) => c.type === 'message-metadata');
      expect(metadataChunk).toBeDefined();
      expect(
        metadataChunk?.type === 'message-metadata' && metadataChunk.messageMetadata,
      ).toMatchObject({
        contextId: 'ctx-456',
        state: 'completed',
        credits: 5,
      });
    });
  });

  describe('artifact-update events', () => {
    it('should handle single artifact with data part', async () => {
      const stream = createMockStream([mockArtifactUpdateEvent, mockStatusUpdateEvent]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      const dataChunk = chunks.find((c) => c.type === 'data-json');
      expect(dataChunk).toBeDefined();
      expect(dataChunk?.type === 'data-json' && dataChunk.data).toMatchObject({
        type: 'analysis',
        results: [1, 2, 3],
        confidence: 0.95,
      });
    });

    it('should handle streaming artifacts with multiple chunks', async () => {
      const stream = createMockStream([
        mockArtifactUpdateFirstChunk,
        mockArtifactUpdateMiddleChunk,
        mockArtifactUpdateLastChunk,
        mockStatusUpdateEvent,
      ]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      // Artifact text parts are filtered out (only data parts processed)
      const textDeltas = chunks.filter((c) => c.type === 'text-delta');
      expect(textDeltas.length).toBeGreaterThanOrEqual(1);
      const lastDelta = textDeltas[textDeltas.length - 1];
      expect(lastDelta?.type === 'text-delta' && lastDelta.delta).toContain('Final status');
    });

    it('should handle artifacts with file (bytes) — filtered out', async () => {
      const stream = createMockStream([mockArtifactWithFile, mockStatusUpdateEvent]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      // File parts in artifacts are filtered out (only data parts processed)
      const fileChunk = chunks.find((c) => c.type === 'file');
      expect(fileChunk).toBeUndefined();

      const finishChunk = chunks.find((c) => c.type === 'finish');
      expect(finishChunk).toBeDefined();
    });

    it('should handle artifacts with file (URI) — filtered out', async () => {
      const stream = createMockStream([mockArtifactWithFileUri, mockStatusUpdateEvent]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      const fileChunk = chunks.find((c) => c.type === 'file');
      expect(fileChunk).toBeUndefined();

      const finishChunk = chunks.find((c) => c.type === 'finish');
      expect(finishChunk).toBeDefined();
    });

    it('should handle files from status-update messages', async () => {
      const statusWithFile: StreamResponse = {
        payload: {
          $case: 'statusUpdate',
          value: {
            taskId: 'task-123',
            contextId: 'ctx-123',
            status: {
              state: TaskState.TASK_STATE_COMPLETED,
              timestamp: new Date().toISOString(),
              message: {
                messageId: 'msg-file',
                contextId: 'ctx-123',
                taskId: 'task-123',
                role: Role.ROLE_AGENT,
                parts: [
                  {
                    content: { $case: 'text', value: 'Here is your file.' },
                    metadata: undefined,
                    filename: '',
                    mediaType: 'text/plain',
                  },
                  {
                    content: {
                      $case: 'raw',
                      value: Buffer.from(
                        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                        'base64',
                      ),
                    },
                    metadata: undefined,
                    filename: 'test.png',
                    mediaType: 'image/png',
                  },
                ],
                metadata: undefined,
                extensions: [],
                referenceTaskIds: [],
              },
            },
            metadata: undefined,
          },
        },
      };

      const stream = createMockStream([statusWithFile]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      const fileChunk = chunks.find((c) => c.type === 'file');
      expect(fileChunk).toBeDefined();
      expect(fileChunk?.type === 'file' && fileChunk.url).toContain('data:image/png;base64,');
      expect(fileChunk?.type === 'file' && fileChunk.mediaType).toBe('image/png');
    });

    it('should emit text-end on final status update', async () => {
      const stream = createMockStream([mockStatusUpdateEvent]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      const textEndChunk = chunks.find((c) => c.type === 'text-end');
      expect(textEndChunk).toBeDefined();

      // Non-final + final: only one text-end from the final
      const stream2 = createMockStream([mockNonFinalStatusUpdate, mockStatusUpdateEvent]);
      const uiStream2 = toUIMessageStream(stream2);
      const chunks2 = await collectChunks(uiStream2);

      const textEndChunks = chunks2.filter((c) => c.type === 'text-end');
      expect(textEndChunks.length).toBe(1);
    });
  });

  describe('text streaming lifecycle', () => {
    it('should emit text-start, text-delta, text-end for text content', async () => {
      const stream = createMockStream([mockStatusUpdateEvent]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      expect(chunks.find((c) => c.type === 'text-start')).toBeDefined();
      expect(chunks.filter((c) => c.type === 'text-delta').length).toBeGreaterThan(0);
      expect(chunks.find((c) => c.type === 'text-end')).toBeDefined();
    });

    it('should handle multiple text parts with same ID', async () => {
      const multiTextEvent: StreamResponse = {
        payload: {
          $case: 'statusUpdate',
          value: {
            taskId: 'task-123',
            contextId: 'ctx-123',
            status: {
              state: TaskState.TASK_STATE_COMPLETED,
              timestamp: new Date().toISOString(),
              message: {
                messageId: 'msg-multi',
                contextId: 'ctx-123',
                taskId: 'task-123',
                role: Role.ROLE_AGENT,
                parts: [
                  {
                    content: { $case: 'text', value: 'First part. ' },
                    metadata: undefined,
                    filename: '',
                    mediaType: 'text/plain',
                  },
                  {
                    content: { $case: 'text', value: 'Second part.' },
                    metadata: undefined,
                    filename: '',
                    mediaType: 'text/plain',
                  },
                ],
                metadata: undefined,
                extensions: [],
                referenceTaskIds: [],
              },
            },
            metadata: undefined,
          },
        },
      };

      const stream = createMockStream([multiTextEvent]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      const textDeltaChunks = chunks.filter((c) => c.type === 'text-delta');
      expect(textDeltaChunks.length).toBeGreaterThan(0);
      const allText = textDeltaChunks.map((c) => (c.type === 'text-delta' ? c.delta : '')).join('');
      expect(allText).toContain('First part');
      expect(allText).toContain('Second part');
    });

    it('should track active text IDs correctly', async () => {
      const stream = createMockStream([mockNonFinalStatusUpdate, mockStatusUpdateEvent]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      const textStartIndex = chunks.findIndex((c) => c.type === 'text-start');
      const firstTextDeltaIndex = chunks.findIndex((c) => c.type === 'text-delta');
      expect(textStartIndex).toBeLessThan(firstTextDeltaIndex);

      const textEndChunks = chunks.filter((c) => c.type === 'text-end');
      expect(textEndChunks.length).toBeGreaterThan(0);
    });
  });

  describe('callbacks', () => {
    it('should call onStart when stream initializes', async () => {
      const callbacks: StreamCallbacks = { onStart: vi.fn() };
      const stream = createMockStream([mockStatusUpdateEvent]);
      const uiStream = toUIMessageStream(stream, { callbacks });
      await collectChunks(uiStream);
      expect(callbacks.onStart).toHaveBeenCalledTimes(1);
    });

    it('should call onEvent for each StreamResponse', async () => {
      const callbacks: StreamCallbacks = { onEvent: vi.fn() };
      const stream = createMockStream([mockNonFinalStatusUpdate, mockStatusUpdateEvent]);
      const uiStream = toUIMessageStream(stream, { callbacks });
      await collectChunks(uiStream);

      expect(callbacks.onEvent).toHaveBeenCalledTimes(2);
      expect(callbacks.onEvent).toHaveBeenCalledWith(mockNonFinalStatusUpdate);
      expect(callbacks.onEvent).toHaveBeenCalledWith(mockStatusUpdateEvent);
    });

    it('should call onFinish with TaskStatus when stream completes', async () => {
      const callbacks: StreamCallbacks = { onFinish: vi.fn() };
      const stream = createMockStream([mockStatusUpdateEvent]);
      const uiStream = toUIMessageStream(stream, { callbacks });
      await collectChunks(uiStream);

      expect(callbacks.onFinish).toHaveBeenCalledTimes(1);
      const finishedState = (callbacks.onFinish as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(finishedState).toBeDefined();
      expect(finishedState.state).toBe(TaskState.TASK_STATE_COMPLETED);
    });

    it('should call onError when stream encounters error', async () => {
      const callbacks: StreamCallbacks = { onError: vi.fn() };

      async function* errorStream(): AsyncGenerator<StreamResponse, void, undefined> {
        yield mockNonFinalStatusUpdate;
        throw new Error('Stream error');
      }

      const uiStream = toUIMessageStream(errorStream(), { callbacks });
      await expect(collectChunks(uiStream)).rejects.toThrow();
    });

    it('should propagate callback errors to the stream', async () => {
      const callbacks: StreamCallbacks = {
        onStart: vi.fn(() => {
          throw new Error('Callback error');
        }),
      };
      const stream = createMockStream([mockStatusUpdateEvent]);
      const uiStream = toUIMessageStream(stream, { callbacks });
      await expect(collectChunks(uiStream)).rejects.toThrow('Callback error');
      expect(callbacks.onStart).toHaveBeenCalled();
    });

    it('should call all callbacks in correct order', async () => {
      const callOrder: string[] = [];
      const callbacks: StreamCallbacks = {
        onStart: vi.fn(() => callOrder.push('start')),
        onEvent: vi.fn(() => callOrder.push('event')),
        onFinish: vi.fn(() => callOrder.push('finish')),
      };
      const stream = createMockStream([mockStatusUpdateEvent]);
      const uiStream = toUIMessageStream(stream, { callbacks });
      await collectChunks(uiStream);

      expect(callOrder[0]).toBe('start');
      expect(callOrder[callOrder.length - 1]).toBe('finish');
      expect(callOrder).toContain('event');
    });
  });

  describe('metadata extraction', () => {
    it('should extract contextId, taskId, state, and credits from final status', async () => {
      const stream = createMockStream([mockStatusUpdateEvent]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      const metadataChunk = chunks.find((c) => c.type === 'message-metadata');
      expect(metadataChunk).toBeDefined();
      expect(
        metadataChunk?.type === 'message-metadata' && metadataChunk.messageMetadata,
      ).toMatchObject({
        contextId: 'ctx-456',
        state: 'completed',
        credits: 5,
      });
    });

    it('should handle missing metadata fields gracefully', async () => {
      const eventWithoutMetadata: StreamResponse = {
        payload: {
          $case: 'statusUpdate',
          value: {
            taskId: 'task-123',
            contextId: 'ctx-123',
            status: {
              state: TaskState.TASK_STATE_COMPLETED,
              timestamp: new Date().toISOString(),
              message: {
                messageId: 'msg-123',
                contextId: 'ctx-123',
                taskId: 'task-123',
                role: Role.ROLE_AGENT,
                parts: [
                  {
                    content: { $case: 'text', value: 'Done' },
                    metadata: undefined,
                    filename: '',
                    mediaType: 'text/plain',
                  },
                ],
                metadata: undefined,
                extensions: [],
                referenceTaskIds: [],
              },
            },
            metadata: undefined,
          },
        },
      };

      const stream = createMockStream([eventWithoutMetadata]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      const metadataChunk = chunks.find((c) => c.type === 'message-metadata');
      expect(metadataChunk).toBeDefined();
      expect(
        metadataChunk?.type === 'message-metadata' && metadataChunk.messageMetadata.credits,
      ).toBe(0);
    });

    it('should emit message-metadata before finish event', async () => {
      const stream = createMockStream([mockStatusUpdateEvent]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      const metadataIndex = chunks.findIndex((c) => c.type === 'message-metadata');
      const finishIndex = chunks.findIndex((c) => c.type === 'finish');
      expect(metadataIndex).toBeGreaterThan(-1);
      expect(finishIndex).toBeGreaterThan(-1);
      expect(metadataIndex).toBeLessThan(finishIndex);
    });
  });

  describe('error handling', () => {
    it('should handle stream errors', async () => {
      async function* errorStream(): AsyncGenerator<StreamResponse, void, undefined> {
        yield mockNonFinalStatusUpdate;
        throw new Error('Test error');
      }

      const uiStream = toUIMessageStream(errorStream());
      try {
        await collectChunks(uiStream);
      } catch {
        // Expected
      }
    });

    it('should handle invalid event payload gracefully', async () => {
      const invalidEvent = { payload: undefined } as StreamResponse;
      const stream = createMockStream([invalidEvent, mockStatusUpdateEvent]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      const finishChunk = chunks.find((c) => c.type === 'finish');
      expect(finishChunk).toBeDefined();
    });
  });

  describe('complete stream scenarios', () => {
    it('should handle full task flow: submitted → working → completed', async () => {
      const stream = createMockStream([
        mockSubmittedStatusUpdate,
        mockNonFinalStatusUpdate,
        mockStatusUpdateEvent,
      ]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      const statusUpdates = chunks.filter((c) => c.type === 'data-status-update');
      expect(statusUpdates.length).toBeGreaterThan(0);

      const metadataChunk = chunks.find((c) => c.type === 'message-metadata');
      const finishChunk = chunks.find((c) => c.type === 'finish');
      expect(metadataChunk).toBeDefined();
      expect(finishChunk).toBeDefined();
    });

    it('should handle stream with artifacts and status updates', async () => {
      const stream = createMockStream([
        mockNonFinalStatusUpdate,
        mockArtifactUpdateEvent,
        mockStatusUpdateEvent,
      ]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      expect(chunks.find((c) => c.type === 'data-status-update')).toBeDefined();
      expect(chunks.find((c) => c.type === 'data-json')).toBeDefined();
    });

    it('should handle stream with multiple artifacts and mixed content', async () => {
      const stream = createMockStream([
        mockNonFinalStatusUpdate,
        mockArtifactUpdateEvent,
        mockArtifactWithFile,
        mockStatusUpdateEvent,
      ]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      expect(chunks.find((c) => c.type === 'data-json')).toBeDefined();
      expect(chunks.find((c) => c.type === 'file')).toBeUndefined();
      expect(chunks.find((c) => c.type === 'finish')).toBeDefined();
    });

    it('should always emit finish event at the end', async () => {
      const stream = createMockStream([
        mockNonFinalStatusUpdate,
        mockArtifactUpdateEvent,
        mockStatusUpdateEvent,
      ]);
      const uiStream = toUIMessageStream(stream);
      const chunks = await collectChunks(uiStream);

      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk?.type).toBe('finish');
    });
  });
});
