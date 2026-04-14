import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CortiClient } from '@corti/sdk';
import { convertToParams, toUIMessageStream, createA2AClientFactory } from '../index.js';
import type { CortiUIMessage, ExpertCredential } from '../types.js';

/**
 * Integration tests with real Corti agents.
 * 
 * These tests require environment variables:
 * - CLIENT_ID
 * - CLIENT_SECRET
 * - ENVIRONMENT
 * - TENANT
 */

function createTestCortiClient(): CortiClient {
  if (
    !process.env.CLIENT_ID ||
    !process.env.CLIENT_SECRET ||
    !process.env.ENVIRONMENT ||
    !process.env.TENANT
  ) {
    throw new Error(
      'Missing required environment variables: CLIENT_ID, CLIENT_SECRET, ENVIRONMENT, TENANT'
    );
  }

  return new CortiClient({
    environment: process.env.ENVIRONMENT,
    tenantName: process.env.TENANT,
    auth: {
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
    },
  });
}

function pause(ms = 1000): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectStreamChunks<T>(stream: ReadableStream<T>): Promise<T[]> {
  const chunks: T[] = [];
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

describe('Integration Tests', () => {
  let cortiClient: CortiClient;
  const createdAgentIds: string[] = [];

  beforeAll(() => {
    try {
      cortiClient = createTestCortiClient();
    } catch (error) {
      console.warn('Skipping integration tests - missing environment variables');
      throw error;
    }
  });

  afterAll(async () => {
    // Cleanup created agents
    for (const agentId of createdAgentIds) {
      try {
        await cortiClient.agents.delete(agentId);
        console.log(`Cleaned up agent ${agentId}`);
      } catch (error) {
        console.warn(`Failed to cleanup agent ${agentId}:`, error);
      }
    }
  });

  describe('Agent Messaging Integration', () => {
    let testAgent: { id?: string };

    beforeAll(async () => {
      // Create a test agent
      testAgent = await cortiClient.agents.create({
        name: 'Test Agent for AI SDK Adapter',
        description: 'Integration test agent',
      });

      if (!testAgent.id) {
        throw new Error('Failed to create test agent');
      }

      createdAgentIds.push(testAgent.id);
      await pause(2000); // Wait for agent to be ready
    });

    it('should stream messages with callbacks and text-delta chunks', async () => {
      const messages: CortiUIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Tell me a short joke' }],
        },
      ];

      const params = convertToParams(messages);

      // Create A2A client factory and verify it works
      const factory = createA2AClientFactory(cortiClient);
      expect(factory).toBeDefined();
      expect(typeof factory.createFromUrl).toBe('function');

      const agentCardUrl = await cortiClient.agents.getCardUrl(testAgent.id);
      const a2aClient = await factory.createFromUrl(agentCardUrl.toString(), '');

      // Track callbacks
      let startCalled = false;
      let finishCalled = false;
      let eventCount = 0;

      const a2aStream = a2aClient.sendMessageStream(params);
      const uiStream = toUIMessageStream(a2aStream, {
        onStart: () => {
          startCalled = true;
        },
        onEvent: () => {
          eventCount++;
        },
        onFinish: () => {
          finishCalled = true;
        },
      });

      const chunks = await collectStreamChunks(uiStream);

      // Verify streaming works
      expect(chunks.length).toBeGreaterThan(0);

      // Verify callbacks were called
      expect(startCalled).toBe(true);
      expect(finishCalled).toBe(true);
      expect(eventCount).toBeGreaterThan(0);

      // Verify finish chunk
      const finishChunk = chunks.find((c) => c.type === 'finish');
      expect(finishChunk).toBeDefined();

      // Verify text content
      const textChunks = chunks.filter((c) => c.type === 'text-delta');
      expect(textChunks.length).toBeGreaterThan(0);
    }, 60000);

    it('should handle context and task continuity across multiple messages', async () => {
      const factory = createA2AClientFactory(cortiClient);
      const agentCardUrl = await cortiClient.agents.getCardUrl(testAgent.id);
      const a2aClient = await factory.createFromUrl(agentCardUrl.toString(), '');

      // Test 1: Context continuity with completed state
      const messages1: CortiUIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'My name is Alice' }],
        },
      ];

      const params1 = convertToParams(messages1);
      const a2aStream1 = a2aClient.sendMessageStream(params1);
      const uiStream1 = toUIMessageStream(a2aStream1);
      const chunks1 = await collectStreamChunks(uiStream1);

      expect(chunks1.length).toBeGreaterThan(0);

      // Extract contextId from finish event
      const finishChunk1 = chunks1.find((c) => c.type === 'finish');
      expect(finishChunk1).toBeDefined();
      const contextId = finishChunk1?.messageMetadata?.contextId;

      // Second message with context (completed state - no taskId)
      const messages2: CortiUIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'My name is Alice' }],
        },
        {
          id: 'msg-2',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Hello Alice!' }],
          metadata: {
            contextId,
            state: 'completed',
          },
        },
        {
          id: 'msg-3',
          role: 'user',
          parts: [{ type: 'text', text: 'What is my name?' }],
        },
      ];

      const params2 = convertToParams(messages2);
      expect(params2.message.contextId).toBe(contextId);
      expect(params2.message.taskId).toBeUndefined(); // Completed state should not include taskId

      const a2aStream2 = a2aClient.sendMessageStream(params2);
      const uiStream2 = toUIMessageStream(a2aStream2);
      const chunks2 = await collectStreamChunks(uiStream2);

      expect(chunks2.length).toBeGreaterThan(0);
      const finishChunk2 = chunks2.find((c) => c.type === 'finish');
      expect(finishChunk2).toBeDefined();

      // Test 2: Task continuation with input-required state
      const messages3: CortiUIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Start a task' }],
        },
      ];

      const params3 = convertToParams(messages3);
      const a2aStream3 = a2aClient.sendMessageStream(params3);
      const uiStream3 = toUIMessageStream(a2aStream3);
      const chunks3 = await collectStreamChunks(uiStream3);

      expect(chunks3.length).toBeGreaterThan(0);

      // Extract contextId and taskId from finish event
      const finishChunk3 = chunks3.find((c) => c.type === 'finish');
      expect(finishChunk3).toBeDefined();
      const taskContextId = finishChunk3?.messageMetadata?.contextId;
      const taskId = finishChunk3?.messageMetadata?.taskId;

      if (taskContextId && taskId) {
        // Continue task with input-required state (should include taskId)
        const messages4: CortiUIMessage[] = [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Start a task' }],
          },
          {
            id: 'msg-2',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Task started, need more info' }],
            metadata: {
              contextId: taskContextId,
              taskId,
              state: 'input-required',
            },
          },
          {
            id: 'msg-3',
            role: 'user',
            parts: [{ type: 'text', text: 'Here is more information' }],
          },
        ];

        const params4 = convertToParams(messages4);
        expect(params4.message.contextId).toBe(taskContextId);
        expect(params4.message.taskId).toBe(taskId); // Input-required state should include taskId

        const a2aStream4 = a2aClient.sendMessageStream(params4);
        const uiStream4 = toUIMessageStream(a2aStream4);
        const chunks4 = await collectStreamChunks(uiStream4);

        expect(chunks4.length).toBeGreaterThan(0);
        const finishChunk4 = chunks4.find((c) => c.type === 'finish');
        expect(finishChunk4).toBeDefined();
      }
    }, 60000);

    it('should properly handle credentials for MCP servers', async () => {
      const credentials: ExpertCredential[] = [
        {
          type: 'bearer',
          mcp_name: 'test-server',
          token: 'test-token-12345',
        },
      ];

      const messages: CortiUIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Test with credentials' }],
        },
      ];

      const params = convertToParams(messages, credentials);

      // Credentials should be included as data parts
      expect(params.message.parts.length).toBeGreaterThan(1);

      const credentialPart = params.message.parts.find(
        (p) =>
          p.kind === 'data' &&
          'type' in (p.data as Record<string, unknown>) &&
          (p.data as Record<string, unknown>).type === 'token'
      );

      expect(credentialPart).toBeDefined();

      // Send via A2A client and verify stream
      const factory = createA2AClientFactory(cortiClient);
      const agentCardUrl = await cortiClient.agents.getCardUrl(testAgent.id);
      const a2aClient = await factory.createFromUrl(agentCardUrl.toString(), '');
      const a2aStream = a2aClient.sendMessageStream(params);
      const uiStream = toUIMessageStream(a2aStream);

      const chunks = await collectStreamChunks(uiStream);

      // Should get a response even if credentials aren't used
      expect(chunks.length).toBeGreaterThan(0);
      const finishChunk = chunks.find((c) => c.type === 'finish');
      expect(finishChunk).toBeDefined();
    }, 60000);
  });
});
