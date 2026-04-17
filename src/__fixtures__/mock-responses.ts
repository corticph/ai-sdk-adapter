import type { Message, Task, TaskStatusUpdateEvent, TaskArtifactUpdateEvent } from '@a2a-js/sdk';

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
 * Mock A2A status update event (final)
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
  metadata: {
    credits: 5,
  },
};

/**
 * Mock A2A status update event (non-final, in progress)
 */
export const mockNonFinalStatusUpdate: TaskStatusUpdateEvent = {
  kind: 'status-update',
  taskId: 'task-789',
  contextId: 'ctx-456',
  final: false,
  status: {
    state: 'working',
    timestamp: new Date().toISOString(),
    message: {
      kind: 'message',
      messageId: 'msg-working',
      role: 'agent',
      parts: [
        {
          kind: 'text',
          text: 'Processing your request...',
        },
      ],
    },
  },
};

/**
 * Mock A2A status update event (submitted state)
 */
export const mockSubmittedStatusUpdate: TaskStatusUpdateEvent = {
  kind: 'status-update',
  taskId: 'task-789',
  contextId: 'ctx-456',
  final: false,
  status: {
    state: 'submitted',
    timestamp: new Date().toISOString(),
  },
};

/**
 * Mock A2A status update event (input-required state)
 */
export const mockInputRequiredStatusUpdate: TaskStatusUpdateEvent = {
  kind: 'status-update',
  taskId: 'task-789',
  contextId: 'ctx-456',
  final: true,
  status: {
    state: 'input-required',
    timestamp: new Date().toISOString(),
    message: {
      kind: 'message',
      messageId: 'msg-input-required',
      role: 'agent',
      parts: [
        {
          kind: 'text',
          text: 'I need more information to continue.',
        },
      ],
    },
  },
  metadata: {
    credits: 3,
  },
};

/**
 * Mock A2A artifact update event (single chunk)
 */
export const mockArtifactUpdateEvent: TaskArtifactUpdateEvent = {
  kind: 'artifact-update',
  taskId: 'task-789',
  contextId: 'ctx-456',
  artifact: {
    artifactId: 'artifact-1',
    parts: [
      {
        kind: 'data',
        data: {
          type: 'analysis',
          results: [1, 2, 3],
          confidence: 0.95,
        },
      },
    ],
  },
  lastChunk: true,
};

/**
 * Mock A2A artifact update event (streaming, first chunk)
 */
export const mockArtifactUpdateFirstChunk: TaskArtifactUpdateEvent = {
  kind: 'artifact-update',
  taskId: 'task-789',
  contextId: 'ctx-456',
  artifact: {
    artifactId: 'artifact-stream',
    parts: [
      {
        kind: 'text',
        text: 'First part of streamed content.',
      },
    ],
  },
  lastChunk: false,
  append: false,
};

/**
 * Mock A2A artifact update event (streaming, middle chunk)
 */
export const mockArtifactUpdateMiddleChunk: TaskArtifactUpdateEvent = {
  kind: 'artifact-update',
  taskId: 'task-789',
  contextId: 'ctx-456',
  artifact: {
    artifactId: 'artifact-stream',
    parts: [
      {
        kind: 'text',
        text: ' Second part of streamed content.',
      },
    ],
  },
  lastChunk: false,
  append: true,
};

/**
 * Mock A2A artifact update event (streaming, last chunk)
 */
export const mockArtifactUpdateLastChunk: TaskArtifactUpdateEvent = {
  kind: 'artifact-update',
  taskId: 'task-789',
  contextId: 'ctx-456',
  artifact: {
    artifactId: 'artifact-stream',
    parts: [
      {
        kind: 'text',
        text: ' Final part of streamed content.',
      },
    ],
  },
  lastChunk: true,
  append: true,
};

/**
 * Mock A2A artifact update with file
 */
export const mockArtifactWithFile: TaskArtifactUpdateEvent = {
  kind: 'artifact-update',
  taskId: 'task-789',
  contextId: 'ctx-456',
  artifact: {
    artifactId: 'artifact-file',
    parts: [
      {
        kind: 'file',
        file: {
          mimeType: 'image/png',
          bytes: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          name: 'test.png',
        },
      },
    ],
  },
  lastChunk: true,
};

/**
 * Mock A2A artifact update with file URI
 */
export const mockArtifactWithFileUri: TaskArtifactUpdateEvent = {
  kind: 'artifact-update',
  taskId: 'task-789',
  contextId: 'ctx-456',
  artifact: {
    artifactId: 'artifact-file-uri',
    parts: [
      {
        kind: 'file',
        file: {
          mimeType: 'application/pdf',
          uri: 'https://example.com/document.pdf',
          name: 'document.pdf',
        },
      },
    ],
  },
  lastChunk: true,
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
