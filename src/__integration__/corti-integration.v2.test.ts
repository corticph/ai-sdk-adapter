import { CortiClient } from '@corti/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { convertToParams, createA2AClientFactory, toUIMessageStream } from '../index.js';
import type { CortiUIMessage } from '../types.js';

/**
 * V2 Agentic API integration tests.
 *
 * Requires environment variables: CLIENT_ID, CLIENT_SECRET, ENVIRONMENT, TENANT
 */

function createTestCortiClient(): CortiClient {
  if (
    !process.env.CLIENT_ID ||
    !process.env.CLIENT_SECRET ||
    !process.env.ENVIRONMENT ||
    !process.env.TENANT
  ) {
    throw new Error(
      'Missing required environment variables: CLIENT_ID, CLIENT_SECRET, ENVIRONMENT, TENANT',
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

const hasRequiredEnvVars =
  process.env.CLIENT_ID &&
  process.env.CLIENT_SECRET &&
  process.env.ENVIRONMENT &&
  process.env.TENANT;

if (!hasRequiredEnvVars) {
  console.log(
    'Skipping v2 integration tests - missing required environment variables (CLIENT_ID, CLIENT_SECRET, ENVIRONMENT, TENANT)',
  );
}

describe.skipIf(!hasRequiredEnvVars)('V2 Agentic Integration Tests', () => {
  let cortiClient: CortiClient;
  const createdAgentIds: string[] = [];

  beforeAll(() => {
    cortiClient = createTestCortiClient();
  });

  afterAll(async () => {
    for (const agentId of createdAgentIds) {
      try {
        await cortiClient.agentic.agents.delete(agentId);
      } catch (error) {
        console.warn(`Failed to cleanup v2 agent ${agentId}:`, error);
      }
    }
  });

  describe('V2 Agent Messaging', () => {
    let testAgentId: string;

    beforeAll(async () => {
      const testAgent = await cortiClient.agentic.agents.create({
        name: `v2-test-agent-${Date.now()}`,
        lifecycle: 'ephemeral',
      });

      testAgentId = testAgent.id;
      createdAgentIds.push(testAgentId);
      await pause(2000);
    });

    it('should stream messages via v2 agentic API', async () => {
      const messages: CortiUIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Tell me a short joke' }],
        },
      ];

      const params = convertToParams(messages);
      const factory = createA2AClientFactory(cortiClient);

      const agentCardUrl = await cortiClient.agentic.agents.getCardUrl(testAgentId);
      const a2aClient = await factory.createFromUrl(agentCardUrl.toString(), '');

      let startCalled = false;
      let finishCalled = false;
      let eventCount = 0;

      const a2aStream = a2aClient.sendMessageStream(params);
      const uiStream = toUIMessageStream(a2aStream, {
        callbacks: {
          onStart: () => {
            startCalled = true;
          },
          onEvent: () => {
            eventCount++;
          },
          onFinish: () => {
            finishCalled = true;
          },
        },
      });

      const chunks = await collectStreamChunks(uiStream);

      expect(chunks.length).toBeGreaterThan(0);
      expect(startCalled).toBe(true);
      expect(finishCalled).toBe(true);
      expect(eventCount).toBeGreaterThan(0);

      const finishChunk = chunks.find((c) => c.type === 'finish');
      expect(finishChunk).toBeDefined();

      const textChunks = chunks.filter((c) => c.type === 'text-delta');
      expect(textChunks.length).toBeGreaterThan(0);
    }, 60000);

    it('should handle context continuity across messages', async () => {
      const factory = createA2AClientFactory(cortiClient);
      const agentCardUrl = await cortiClient.agentic.agents.getCardUrl(testAgentId);
      const a2aClient = await factory.createFromUrl(agentCardUrl.toString(), '');

      // First message
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

      const metadataChunk1 = chunks1.find((c) => c.type === 'message-metadata');
      expect(metadataChunk1).toBeDefined();
      const contextId = metadataChunk1?.messageMetadata?.contextId;
      expect(contextId).toBeTruthy();

      // Follow-up using contextId
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
      expect(params2.message?.contextId).toBe(contextId);
      expect(params2.message?.taskId).toBeFalsy();

      const a2aStream2 = a2aClient.sendMessageStream(params2);
      const uiStream2 = toUIMessageStream(a2aStream2);
      const chunks2 = await collectStreamChunks(uiStream2);

      expect(chunks2.length).toBeGreaterThan(0);
      const finishChunk2 = chunks2.find((c) => c.type === 'finish');
      expect(finishChunk2).toBeDefined();
    }, 60000);
  });
});
