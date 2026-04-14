import type { CortiUIMessage, ChatCredential } from '../types.js';
import { buildParams } from '../build-params.js';
import { describe, expect, it } from 'vitest';

describe('buildParams', () => {
  const mockUserMessage: CortiUIMessage = {
    id: 'msg-123',
    role: 'user',
    parts: [{ type: 'text', text: 'Hello' }],
  };

  it('should build basic params without credentials', () => {
    const params = buildParams([mockUserMessage]);
    expect(params.message.role).toBe('user');
    expect(params.message.parts[0]).toMatchObject({ kind: 'text', text: 'Hello' });
    expect(params.message.contextId).toBeUndefined();
    expect(params.message.taskId).toBeUndefined();
  });

  it('should infer contextId from last assistant message', () => {
    const assistantMessage: CortiUIMessage = {
      id: 'msg-assistant',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Hi there' }],
      metadata: {
        contextId: 'ctx-456',
      },
    };

    const params = buildParams([assistantMessage, mockUserMessage]);
    expect(params.message.contextId).toBe('ctx-456');
  });

  it('should infer taskId from last assistant message only if state is input-required', () => {
    const assistantMessage: CortiUIMessage = {
      id: 'msg-assistant',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Hi there' }],
      metadata: {
        taskId: 'task-789',
        state: 'input-required',
      },
    };

    const params = buildParams([assistantMessage, mockUserMessage]);
    expect(params.message.taskId).toBe('task-789');
  });

  it('should NOT infer taskId if state is not input-required', () => {
    const assistantMessage: CortiUIMessage = {
      id: 'msg-assistant',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Task completed' }],
      metadata: {
        taskId: 'task-789',
        contextId: 'ctx-456',
        state: 'completed',
      },
    };

    const params = buildParams([assistantMessage, mockUserMessage]);
    expect(params.message.contextId).toBe('ctx-456');
    expect(params.message.taskId).toBeUndefined();
  });

  it('should infer both contextId and taskId from last assistant message when state is input-required', () => {
    const assistantMessage: CortiUIMessage = {
      id: 'msg-assistant',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Hi there' }],
      metadata: {
        contextId: 'ctx-456',
        taskId: 'task-789',
        state: 'input-required',
      },
    };

    const params = buildParams([assistantMessage, mockUserMessage]);
    expect(params.message.contextId).toBe('ctx-456');
    expect(params.message.taskId).toBe('task-789');
  });

  it('should add bearer token credentials when no taskId', () => {
    const credentials: ChatCredential[] = [
      {
        mcp_name: 'test-server',
        token: 'test-token',
        type: 'bearer',
      },
    ];

    const params = buildParams([mockUserMessage], credentials);

    expect(params.message.parts.length).toBeGreaterThan(1);
    const credentialPart = params.message.parts.find(
      (p) =>
        p.kind === 'data' &&
        'type' in (p.data as Record<string, unknown>) &&
        (p.data as Record<string, unknown>).type === 'token',
    );
    expect(credentialPart).toBeDefined();
  });

  it('should add OAuth credentials when no taskId', () => {
    const credentials: ChatCredential[] = [
      {
        mcp_name: 'test-server',
        client_id: 'client-123',
        client_secret: 'secret-456',
        type: 'oauth2.0',
      },
    ];

    const params = buildParams([mockUserMessage], credentials);

    expect(params.message.parts.length).toBeGreaterThan(1);
    const credentialPart = params.message.parts.find(
      (p) =>
        p.kind === 'data' &&
        'type' in (p.data as Record<string, unknown>) &&
        (p.data as Record<string, unknown>).type === 'credentials',
    );
    expect(credentialPart).toBeDefined();
  });

  it('should not add credentials when taskId is inferred from assistant message with input-required state', () => {
    const credentials: ChatCredential[] = [
      {
        mcp_name: 'test-server',
        token: 'test-token',
        type: 'bearer',
      },
    ];

    const assistantMessage: CortiUIMessage = {
      id: 'msg-assistant',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Hi there' }],
      metadata: {
        taskId: 'task-789',
        state: 'input-required',
      },
    };

    // Create a fresh user message
    const freshUserMessage: CortiUIMessage = {
      id: 'msg-user',
      role: 'user',
      parts: [{ type: 'text', text: 'Continue' }],
    };

    const params = buildParams([assistantMessage, freshUserMessage], credentials);

    // Credentials should not be added when taskId is present
    expect(params.message.parts.length).toBe(1);
    expect(params.message.taskId).toBe('task-789');
  });

  it('should use the last message in the array', () => {
    const messages: CortiUIMessage[] = [
      { ...mockUserMessage, id: 'msg-1' },
      { ...mockUserMessage, id: 'msg-2' },
      { ...mockUserMessage, id: 'msg-3' },
    ];

    const params = buildParams(messages);
    expect(params.message.parts[0]).toMatchObject({ kind: 'text', text: 'Hello' });
  });

  it('should handle multiple assistant messages and use the latest one with correct state handling', () => {
    const assistant1: CortiUIMessage = {
      id: 'msg-assistant-1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'First response' }],
      metadata: {
        contextId: 'ctx-old',
        taskId: 'task-old',
        state: 'input-required',
      },
    };

    const assistant2: CortiUIMessage = {
      id: 'msg-assistant-2',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Second response' }],
      metadata: {
        contextId: 'ctx-new',
        taskId: 'task-new',
        state: 'input-required',
      },
    };

    const params = buildParams([assistant1, mockUserMessage, assistant2, mockUserMessage]);
    expect(params.message.contextId).toBe('ctx-new');
    expect(params.message.taskId).toBe('task-new');
  });

  it('should add credentials when last assistant state is completed (not input-required)', () => {
    const credentials: ChatCredential[] = [
      {
        mcp_name: 'test-server',
        token: 'test-token',
        type: 'bearer',
      },
    ];

    const assistantMessage: CortiUIMessage = {
      id: 'msg-assistant',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Done' }],
      metadata: {
        contextId: 'ctx-456',
        taskId: 'task-789',
        state: 'completed',
      },
    };

    const params = buildParams([assistantMessage, mockUserMessage], credentials);

    // Should add credentials because state is not input-required
    expect(params.message.parts.length).toBeGreaterThan(1);
    expect(params.message.contextId).toBe('ctx-456');
    expect(params.message.taskId).toBeUndefined();
  });
});
