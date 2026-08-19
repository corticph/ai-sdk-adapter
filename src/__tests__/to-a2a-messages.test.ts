import { Role } from '@a2a-js/sdk';
import { describe, expect, it, vi } from 'vitest';
import { toA2AMessages } from '../helpers/to-a2a-messages.js';
import type { CortiUIMessage } from '../types.js';

describe('toA2AMessages', () => {
  it('should convert basic message structures with role mapping', () => {
    let uiMessages: CortiUIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
      },
    ];
    let a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages).toHaveLength(1);
    expect(a2aMessages[0].role).toBe(Role.ROLE_USER);
    expect(a2aMessages[0].parts[0].content).toEqual({ $case: 'text', value: 'Hello' });
    expect(a2aMessages[0].messageId).toBeDefined();

    // Assistant → ROLE_AGENT
    uiMessages = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hi there' }],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].role).toBe(Role.ROLE_AGENT);

    // Filter system messages
    uiMessages = [
      {
        id: 'msg-1',
        role: 'system',
        parts: [{ type: 'text', text: 'System prompt' }],
      },
      {
        id: 'msg-2',
        role: 'user',
        parts: [{ type: 'text', text: 'User message' }],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages).toHaveLength(1);
    expect(a2aMessages[0].role).toBe(Role.ROLE_USER);

    // Multiple messages
    uiMessages = [
      { id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      { id: 'msg-2', role: 'assistant', parts: [{ type: 'text', text: 'Hi' }] },
      { id: 'msg-3', role: 'user', parts: [{ type: 'text', text: 'How are you?' }] },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages).toHaveLength(3);
    expect(a2aMessages[0].role).toBe(Role.ROLE_USER);
    expect(a2aMessages[1].role).toBe(Role.ROLE_AGENT);
    expect(a2aMessages[2].role).toBe(Role.ROLE_USER);

    // Empty array and empty parts
    expect(toA2AMessages([])).toHaveLength(0);
    uiMessages = [{ id: 'msg-1', role: 'user', parts: [] }];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts).toHaveLength(0);
  });

  it('should convert text and data-text parts correctly', () => {
    let uiMessages: CortiUIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello world' }],
      },
    ];
    let a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts[0].content).toEqual({ $case: 'text', value: 'Hello world' });

    // Multiple text parts
    uiMessages = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [
          { type: 'text', text: 'First part' },
          { type: 'text', text: 'Second part' },
        ],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts).toHaveLength(2);
    expect(a2aMessages[0].parts[0].content).toEqual({ $case: 'text', value: 'First part' });
    expect(a2aMessages[0].parts[1].content).toEqual({ $case: 'text', value: 'Second part' });

    // data-text converts to text
    uiMessages = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'data-text', data: 'Text from data' }],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts[0].content).toEqual({ $case: 'text', value: 'Text from data' });

    // Mixed text and data-text
    uiMessages = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [
          { type: 'text', text: 'Regular text' },
          { type: 'data-text', data: 'Data text' },
        ],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts[0].content).toEqual({ $case: 'text', value: 'Regular text' });
    expect(a2aMessages[0].parts[1].content).toEqual({ $case: 'text', value: 'Data text' });
  });

  it('should convert data-json parts to data content', () => {
    let uiMessages: CortiUIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [
          {
            type: 'data-json',
            data: { key: 'value', number: 42, nested: { prop: true } },
          },
        ],
      },
    ];
    let a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts[0].content).toEqual({
      $case: 'data',
      value: { key: 'value', number: 42, nested: { prop: true } },
    });

    // Array data
    uiMessages = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'data-json', data: [1, 2, 3] }],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts[0].content).toEqual({ $case: 'data', value: [1, 2, 3] });

    // Complex nested structure
    const complexData = {
      users: [
        { id: 1, name: 'Alice', active: true },
        { id: 2, name: 'Bob', active: false },
      ],
      metadata: { total: 2, filters: { status: 'all' } },
    };
    uiMessages = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'data-json', data: complexData }],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts[0].content).toEqual({ $case: 'data', value: complexData });

    // null/undefined values
    uiMessages = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [
          { type: 'data-json', data: null },
          { type: 'data-json', data: undefined },
        ],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts[0].content).toEqual({ $case: 'data', value: null });
    expect(a2aMessages[0].parts[1].content).toEqual({ $case: 'data', value: undefined });
  });

  it('should convert file parts based on URL format', () => {
    // HTTP URL → url content
    let uiMessages: CortiUIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [
          {
            type: 'file',
            mediaType: 'application/pdf',
            url: 'http://example.com/document.pdf',
          },
        ],
      },
    ];
    let a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts[0]).toMatchObject({
      content: { $case: 'url', value: 'http://example.com/document.pdf' },
      mediaType: 'application/pdf',
      filename: 'file',
    });

    // HTTPS URL
    uiMessages = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'file', mediaType: 'image/png', url: 'https://example.com/image.png' }],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts[0].content).toEqual({
      $case: 'url',
      value: 'https://example.com/image.png',
    });

    // base64 data URL → raw content (Buffer)
    const base64Data =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    uiMessages = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [
          { type: 'file', mediaType: 'image/png', url: `data:image/png;base64,${base64Data}` },
        ],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts[0].content?.$case).toBe('raw');
    expect(a2aMessages[0].parts[0].mediaType).toBe('image/png');
    expect(a2aMessages[0].parts[0].filename).toBe('file');

    // JSON data URL → data content
    const jsonData = { status: 'success', count: 42 };
    const jsonBase64 = Buffer.from(JSON.stringify(jsonData)).toString('base64');
    uiMessages = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [
          {
            type: 'file',
            mediaType: 'application/json',
            url: `data:application/json;base64,${jsonBase64}`,
          },
        ],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts[0].content).toEqual({ $case: 'data', value: jsonData });

    // Unsupported URL formats throw
    expect(() =>
      toA2AMessages([
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'file', mediaType: 'image/png', url: 'file:///local/path/image.png' }],
        },
      ]),
    ).toThrow('Unsupported file URL format');

    expect(() =>
      toA2AMessages([
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'file', mediaType: 'text/plain', url: 'data:text/plain,Hello%20World' }],
        },
      ]),
    ).toThrow('Unsupported file URL format');
  });

  it('should handle mixed part types and filter unsupported types', () => {
    const uiMessages: CortiUIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [
          { type: 'text', text: 'Check this out' },
          { type: 'file', mediaType: 'application/pdf', url: 'https://example.com/doc.pdf' },
          { type: 'data-json', data: { note: 'important' } },
          { type: 'data-text', data: 'Extra info' },
        ],
      },
    ];
    let a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts).toHaveLength(4);
    expect(a2aMessages[0].parts[0].content?.$case).toBe('text');
    expect(a2aMessages[0].parts[1].content?.$case).toBe('url');
    expect(a2aMessages[0].parts[2].content?.$case).toBe('data');
    expect(a2aMessages[0].parts[3].content?.$case).toBe('text');

    // Unsupported types are filtered out
    const mixedMessages: CortiUIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [
          { type: 'text', text: 'Hello' },
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'test' },
          { type: 'tool-result', toolCallId: 'call-1', result: 'result' },
          { type: 'image', image: 'base64data' },
          { type: 'data-json', data: { valid: true } },
          // biome-ignore lint/suspicious/noExplicitAny: testing unsupported part types
        ] as any,
      },
    ];
    a2aMessages = toA2AMessages(mixedMessages);
    expect(a2aMessages[0].parts).toHaveLength(2);
    expect(a2aMessages[0].parts[0].content).toEqual({ $case: 'text', value: 'Hello' });
    expect(a2aMessages[0].parts[1].content).toEqual({ $case: 'data', value: { valid: true } });
  });

  it('should support custom ID generation', () => {
    let counter = 0;
    const customGenerateId = vi.fn(() => `custom-id-${++counter}`);
    const uiMessages: CortiUIMessage[] = [
      { id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'First' }] },
      { id: 'msg-2', role: 'user', parts: [{ type: 'text', text: 'Second' }] },
    ];
    let a2aMessages = toA2AMessages(uiMessages, { generateId: customGenerateId });
    expect(customGenerateId).toHaveBeenCalledTimes(2);
    expect(a2aMessages[0].messageId).toBe('custom-id-1');
    expect(a2aMessages[1].messageId).toBe('custom-id-2');

    // Default generateId creates valid IDs
    a2aMessages = toA2AMessages([
      { id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
    ]);
    expect(a2aMessages[0].messageId).toBeDefined();
    expect(typeof a2aMessages[0].messageId).toBe('string');
    expect(a2aMessages[0].messageId.length).toBeGreaterThan(0);
  });

  it('should handle edge cases correctly', () => {
    // Metadata is not copied to A2A messages
    let uiMessages: CortiUIMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Response' }],
        metadata: { contextId: 'ctx-123', taskId: 'task-456', state: 'completed' },
      },
    ];
    let a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].role).toBe(Role.ROLE_AGENT);
    expect(a2aMessages[0].parts[0].content).toEqual({ $case: 'text', value: 'Response' });
    // contextId/taskId on the message are empty strings (defaults), not from UI metadata
    expect(a2aMessages[0].contextId).toBe('');

    // Empty text parts
    uiMessages = [{ id: 'msg-1', role: 'user', parts: [{ type: 'text', text: '' }] }];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts[0].content).toEqual({ $case: 'text', value: '' });

    // No mutation of input
    uiMessages = [{ id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }];
    const originalRole = uiMessages[0].role;
    const originalPartsLength = uiMessages[0].parts.length;
    toA2AMessages(uiMessages);
    expect(uiMessages[0].role).toBe(originalRole);
    expect(uiMessages[0].parts).toHaveLength(originalPartsLength);
  });
});
