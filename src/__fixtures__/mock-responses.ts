import type { Message, Task, TaskStatusUpdateEvent } from '@a2a-js/sdk';

/**
 * Mock A2A message response
 */
export const mockMessageResponse: Message = {
  kind: 'message',
  messageId: 'msg-123',
  contextId: 'ctx-456',
  role: 'agent',
  parts: [
    {
      kind: 'text',
      text: 'Hello, this is a test response.',
    },
  ],
};

/**
 * Mock A2A task response
 */
export const mockTaskResponse: Task = {
  kind: 'task',
  id: 'task-789',
  contextId: 'ctx-456',
  status: {
    state: 'completed',
    timestamp: new Date().toISOString(),
    message: {
      kind: 'message',
      messageId: 'msg-123',
      role: 'agent',
      parts: [
        {
          kind: 'text',
          text: 'Task completed successfully.',
        },
      ],
    },
  },
  artifacts: [
    {
      artifactId: 'artifact-1',
      parts: [
        {
          kind: 'file',
          file: {
            mimeType: 'application/json',
            bytes: Buffer.from(JSON.stringify({ result: 'success' })).toString('base64'),
            name: 'result.json',
          },
        },
      ],
    },
  ],
  metadata: {
    credits: 10,
  },
};

/**
 * Mock A2A status update event
 */
export const mockStatusUpdateEvent: TaskStatusUpdateEvent = {
  kind: 'status-update',
  taskId: 'task-789',
  contextId: 'ctx-456',
  final: true,
  status: {
    state: 'completed',
    timestamp: new Date().toISOString(),
    message: {
      kind: 'message',
      messageId: 'msg-final',
      role: 'agent',
      parts: [
        {
          kind: 'text',
          text: 'Final status message.',
        },
      ],
    },
  },
};

/**
 * Mock error response
 */
export const mockErrorResponse = {
  error: {
    code: -32000,
    message: 'Test error',
    data: {
      error: 'Detailed error message',
    },
  },
};
