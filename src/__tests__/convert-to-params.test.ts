import { describe, expect, it } from 'vitest';
import { convertToParams } from '../convert-to-params.js';
import type { ExpertCredential, CortiUIMessage } from '../types.js';

describe('convertToParams', () => {
  const mockUserMessage: CortiUIMessage = {
    id: 'msg-123',
    role: 'user',
    parts: [{ type: 'text', text: 'Hello' }],
  };

  it('should infer contextId and taskId from assistant metadata based on state', () => {
    // Test 1: Basic inference of contextId
    const withContext: CortiUIMessage = {
      id: 'msg-assistant',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Hi there' }],
      metadata: { contextId: 'ctx-456' },
    };
    let params = convertToParams([withContext, mockUserMessage]);
    expect(params.message.contextId).toBe('ctx-456');
    expect(params.message.taskId).toBeUndefined();

    // Test 2: Infer taskId only when state is input-required
    const withTaskInputRequired: CortiUIMessage = {
      id: 'msg-assistant',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Need input' }],
      metadata: {
        contextId: 'ctx-456',
        taskId: 'task-789',
        state: 'input-required',
      },
    };
    params = convertToParams([withTaskInputRequired, mockUserMessage]);
    expect(params.message.contextId).toBe('ctx-456');
    expect(params.message.taskId).toBe('task-789');

    // Test 3: Do NOT infer taskId when state is completed
    const withTaskCompleted: CortiUIMessage = {
      id: 'msg-assistant',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Done' }],
      metadata: {
        contextId: 'ctx-456',
        taskId: 'task-789',
        state: 'completed',
      },
    };
    params = convertToParams([withTaskCompleted, mockUserMessage]);
    expect(params.message.contextId).toBe('ctx-456');
    expect(params.message.taskId).toBeUndefined();

    // Test 4: Use latest assistant message when multiple exist
    const assistant1: CortiUIMessage = {
      id: 'msg-old',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Old' }],
      metadata: {
        contextId: 'ctx-old',
        taskId: 'task-old',
        state: 'input-required',
      },
    };
    const assistant2: CortiUIMessage = {
      id: 'msg-new',
      role: 'assistant',
      parts: [{ type: 'text', text: 'New' }],
      metadata: {
        contextId: 'ctx-new',
        taskId: 'task-new',
        state: 'input-required',
      },
    };
    params = convertToParams([assistant1, mockUserMessage, assistant2, mockUserMessage]);
    expect(params.message.contextId).toBe('ctx-new');
    expect(params.message.taskId).toBe('task-new');

    // Test 5: Handle undefined/missing metadata
    const noMetadata: CortiUIMessage = {
      id: 'msg-assistant',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Response' }],
    };
    params = convertToParams([noMetadata, mockUserMessage]);
    expect(params.message.contextId).toBeUndefined();
    expect(params.message.taskId).toBeUndefined();
  });

  it('should handle credential injection based on taskId state', () => {
    // Test 1: Add bearer token when no taskId
    const bearerCreds: ExpertCredential[] = [
      {
        mcp_name: 'test-server',
        token: 'test-token',
        type: 'bearer',
      },
    ];
    let params = convertToParams([mockUserMessage], bearerCreds);
    expect(params.message.parts.length).toBeGreaterThan(1);
    let credPart = params.message.parts.find(
      (p) => p.kind === 'data' && 'type' in (p.data as Record<string, unknown>) && (p.data as Record<string, unknown>).type === 'token'
    );
    expect(credPart).toBeDefined();

    // Test 2: Add OAuth credentials when no taskId
    const oauthCreds: ExpertCredential[] = [
      {
        mcp_name: 'test-server',
        client_id: 'client-123',
        client_secret: 'secret-456',
        type: 'oauth2.0',
      },
    ];
    params = convertToParams([mockUserMessage], oauthCreds);
    credPart = params.message.parts.find(
      (p) => p.kind === 'data' && 'type' in (p.data as Record<string, unknown>) && (p.data as Record<string, unknown>).type === 'credentials'
    );
    expect(credPart).toBeDefined();

    // Test 3: Do NOT add credentials when taskId is present (input-required)
    const assistantWithTask: CortiUIMessage = {
      id: 'msg-assistant',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Task active' }],
      metadata: {
        taskId: 'task-789',
        state: 'input-required',
      },
    };
    params = convertToParams([assistantWithTask, mockUserMessage], bearerCreds);
    expect(params.message.parts.length).toBe(1);
    expect(params.message.taskId).toBe('task-789');

    // Test 4: Add credentials when task is completed (no taskId inferred)
    const assistantCompleted: CortiUIMessage = {
      id: 'msg-assistant',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Done' }],
      metadata: {
        contextId: 'ctx-456',
        taskId: 'task-789',
        state: 'completed',
      },
    };
    params = convertToParams([assistantCompleted, mockUserMessage], bearerCreds);
    expect(params.message.parts.length).toBeGreaterThan(1);
    expect(params.message.contextId).toBe('ctx-456');
    expect(params.message.taskId).toBeUndefined();

    // Test 5: Handle multiple credential types
    const multiCreds: ExpertCredential[] = [
      {
        mcp_name: 'server-1',
        token: 'token-1',
        type: 'bearer',
      },
      {
        mcp_name: 'server-2',
        client_id: 'client-2',
        client_secret: 'secret-2',
        type: 'oauth2.0',
      },
    ];
    params = convertToParams([mockUserMessage], multiCreds);
    expect(params.message.parts.length).toBe(3); // 1 text + 2 credentials
  });

  it('should convert various message part types correctly', () => {
    // Test 1: File parts with HTTP URL
    const messageWithFile: CortiUIMessage = {
      id: 'msg-file',
      role: 'user',
      parts: [
        { type: 'text', text: 'Check this' },
        { type: 'file', mediaType: 'image/png', url: 'https://example.com/image.png' },
      ],
    };
    let params = convertToParams([messageWithFile]);
    expect(params.message.parts.length).toBe(2);
    expect(params.message.parts[1]).toMatchObject({
      kind: 'file',
      file: {
        mimeType: 'image/png',
        uri: 'https://example.com/image.png',
        name: 'file',
      },
    });

    // Test 2: Base64 file data
    const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const messageWithBase64: CortiUIMessage = {
      id: 'msg-base64',
      role: 'user',
      parts: [
        { type: 'file', mediaType: 'image/png', url: `data:image/png;base64,${base64Image}` },
      ],
    };
    params = convertToParams([messageWithBase64]);
    expect(params.message.parts[0]).toMatchObject({
      kind: 'file',
      file: {
        mimeType: 'image/png',
        bytes: base64Image,
        name: 'file',
      },
    });

    // Test 3: Data-json parts
    const messageWithDataJson: CortiUIMessage = {
      id: 'msg-data',
      role: 'user',
      parts: [
        { type: 'text', text: 'Data' },
        { type: 'data-json', data: { key: 'value', number: 42 } },
      ],
    };
    params = convertToParams([messageWithDataJson]);
    expect(params.message.parts[1]).toMatchObject({
      kind: 'data',
      data: { key: 'value', number: 42 },
    });

    // Test 4: Data-text parts
    const messageWithDataText: CortiUIMessage = {
      id: 'msg-data-text',
      role: 'user',
      parts: [
        { type: 'text', text: 'Regular' },
        { type: 'data-text', data: 'Data as text' },
      ],
    };
    params = convertToParams([messageWithDataText]);
    expect(params.message.parts[1]).toMatchObject({ kind: 'text', text: 'Data as text' });
  });

  it('should handle edge cases correctly', () => {
    // Test 1: Use last message in array
    const messages: CortiUIMessage[] = [
      { ...mockUserMessage, id: 'msg-1' },
      { ...mockUserMessage, id: 'msg-2' },
      { ...mockUserMessage, id: 'msg-3' },
    ];
    let params = convertToParams(messages);
    expect(params.message.parts[0]).toMatchObject({ kind: 'text', text: 'Hello' });

    // Test 2: Single message
    params = convertToParams([mockUserMessage]);
    expect(params.message.role).toBe('user');
    expect(params.message.contextId).toBeUndefined();
    expect(params.message.taskId).toBeUndefined();

    // Test 3: Only assistant messages (converts to 'agent' role)
    const assistantOnly: CortiUIMessage = {
      id: 'msg-assistant',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Assistant response' }],
      metadata: {
        contextId: 'ctx-123',
        state: 'completed',
      },
    };
    params = convertToParams([assistantOnly]);
    expect(params.message.role).toBe('agent');
    expect(params.message.contextId).toBe('ctx-123');
  });
});
