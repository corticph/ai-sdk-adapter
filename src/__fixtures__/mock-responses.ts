import {
  type Message,
  type Task,
  type StreamResponse,
  type TaskStatusUpdateEvent,
  type TaskArtifactUpdateEvent,
  TaskState,
  Role,
} from '@a2a-js/sdk';

export const mockMessage: Message = {
  messageId: 'msg-123',
  contextId: 'ctx-456',
  taskId: '',
  role: Role.ROLE_AGENT,
  parts: [
    {
      content: { $case: 'text', value: 'Hello, this is a test response.' },
      metadata: undefined,
      filename: '',
      mediaType: 'text/plain',
    },
  ],
  metadata: undefined,
  extensions: [],
  referenceTaskIds: [],
};

export const mockTask: Task = {
  id: 'task-789',
  contextId: 'ctx-456',
  status: {
    state: TaskState.TASK_STATE_COMPLETED,
    timestamp: new Date().toISOString(),
    message: {
      messageId: 'msg-123',
      contextId: 'ctx-456',
      taskId: 'task-789',
      role: Role.ROLE_AGENT,
      parts: [
        {
          content: { $case: 'text', value: 'Task completed successfully.' },
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
  artifacts: [
    {
      artifactId: 'artifact-1',
      parts: [
        {
          content: {
            $case: 'raw',
            value: Buffer.from(JSON.stringify({ result: 'success' })),
          },
          metadata: undefined,
          filename: 'result.json',
          mediaType: 'application/json',
        },
      ],
    },
  ],
  history: [],
  metadata: { credits: 10 },
};

const statusUpdateFinal: TaskStatusUpdateEvent = {
  taskId: 'task-789',
  contextId: 'ctx-456',
  status: {
    state: TaskState.TASK_STATE_COMPLETED,
    timestamp: new Date().toISOString(),
    message: {
      messageId: 'msg-final',
      contextId: 'ctx-456',
      taskId: 'task-789',
      role: Role.ROLE_AGENT,
      parts: [
        {
          content: { $case: 'text', value: 'Final status message.' },
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
  metadata: { credits: 5 },
};

const statusUpdateWorking: TaskStatusUpdateEvent = {
  taskId: 'task-789',
  contextId: 'ctx-456',
  status: {
    state: TaskState.TASK_STATE_WORKING,
    timestamp: new Date().toISOString(),
    message: {
      messageId: 'msg-working',
      contextId: 'ctx-456',
      taskId: 'task-789',
      role: Role.ROLE_AGENT,
      parts: [
        {
          content: { $case: 'text', value: 'Processing your request...' },
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
};

const statusUpdateSubmitted: TaskStatusUpdateEvent = {
  taskId: 'task-789',
  contextId: 'ctx-456',
  status: {
    state: TaskState.TASK_STATE_SUBMITTED,
    timestamp: new Date().toISOString(),
    message: undefined,
  },
  metadata: undefined,
};

const statusUpdateInputRequired: TaskStatusUpdateEvent = {
  taskId: 'task-789',
  contextId: 'ctx-456',
  status: {
    state: TaskState.TASK_STATE_INPUT_REQUIRED,
    timestamp: new Date().toISOString(),
    message: {
      messageId: 'msg-input-required',
      contextId: 'ctx-456',
      taskId: 'task-789',
      role: Role.ROLE_AGENT,
      parts: [
        {
          content: { $case: 'text', value: 'I need more information to continue.' },
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
  metadata: { credits: 3 },
};

const artifactUpdateSingle: TaskArtifactUpdateEvent = {
  taskId: 'task-789',
  contextId: 'ctx-456',
  artifact: {
    artifactId: 'artifact-1',
    parts: [
      {
        content: {
          $case: 'data',
          value: { type: 'analysis', results: [1, 2, 3], confidence: 0.95 },
        },
        metadata: undefined,
        filename: '',
        mediaType: '',
      },
    ],
  },
  lastChunk: true,
  append: false,
  metadata: undefined,
};

const artifactUpdateFirstChunk: TaskArtifactUpdateEvent = {
  taskId: 'task-789',
  contextId: 'ctx-456',
  artifact: {
    artifactId: 'artifact-stream',
    parts: [
      {
        content: { $case: 'text', value: 'First part of streamed content.' },
        metadata: undefined,
        filename: '',
        mediaType: 'text/plain',
      },
    ],
  },
  lastChunk: false,
  append: false,
  metadata: undefined,
};

const artifactUpdateMiddleChunk: TaskArtifactUpdateEvent = {
  taskId: 'task-789',
  contextId: 'ctx-456',
  artifact: {
    artifactId: 'artifact-stream',
    parts: [
      {
        content: { $case: 'text', value: ' Second part of streamed content.' },
        metadata: undefined,
        filename: '',
        mediaType: 'text/plain',
      },
    ],
  },
  lastChunk: false,
  append: true,
  metadata: undefined,
};

const artifactUpdateLastChunk: TaskArtifactUpdateEvent = {
  taskId: 'task-789',
  contextId: 'ctx-456',
  artifact: {
    artifactId: 'artifact-stream',
    parts: [
      {
        content: { $case: 'text', value: ' Final part of streamed content.' },
        metadata: undefined,
        filename: '',
        mediaType: 'text/plain',
      },
    ],
  },
  lastChunk: true,
  append: true,
  metadata: undefined,
};

const artifactWithFile: TaskArtifactUpdateEvent = {
  taskId: 'task-789',
  contextId: 'ctx-456',
  artifact: {
    artifactId: 'artifact-file',
    parts: [
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
  },
  lastChunk: true,
  append: false,
  metadata: undefined,
};

const artifactWithFileUri: TaskArtifactUpdateEvent = {
  taskId: 'task-789',
  contextId: 'ctx-456',
  artifact: {
    artifactId: 'artifact-file-uri',
    parts: [
      {
        content: { $case: 'url', value: 'https://example.com/document.pdf' },
        metadata: undefined,
        filename: 'document.pdf',
        mediaType: 'application/pdf',
      },
    ],
  },
  lastChunk: true,
  append: false,
  metadata: undefined,
};

function wrapStatusUpdate(event: TaskStatusUpdateEvent): StreamResponse {
  return { payload: { $case: 'statusUpdate', value: event } };
}

function wrapArtifactUpdate(event: TaskArtifactUpdateEvent): StreamResponse {
  return { payload: { $case: 'artifactUpdate', value: event } };
}

export const mockStatusUpdateEvent = wrapStatusUpdate(statusUpdateFinal);
export const mockNonFinalStatusUpdate = wrapStatusUpdate(statusUpdateWorking);
export const mockSubmittedStatusUpdate = wrapStatusUpdate(statusUpdateSubmitted);
export const mockInputRequiredStatusUpdate = wrapStatusUpdate(statusUpdateInputRequired);

export const mockArtifactUpdateEvent = wrapArtifactUpdate(artifactUpdateSingle);
export const mockArtifactUpdateFirstChunk = wrapArtifactUpdate(artifactUpdateFirstChunk);
export const mockArtifactUpdateMiddleChunk = wrapArtifactUpdate(artifactUpdateMiddleChunk);
export const mockArtifactUpdateLastChunk = wrapArtifactUpdate(artifactUpdateLastChunk);
export const mockArtifactWithFile = wrapArtifactUpdate(artifactWithFile);
export const mockArtifactWithFileUri = wrapArtifactUpdate(artifactWithFileUri);

export const mockErrorResponse = {
  error: {
    code: -32000,
    message: 'Test error',
    data: {
      error: 'Detailed error message',
    },
  },
};
