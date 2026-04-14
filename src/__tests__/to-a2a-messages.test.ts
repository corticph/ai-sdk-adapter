import { describe, expect, it, vi } from 'vitest';
import { toA2AMessages } from '../helpers/to-a2a-messages.js';
import type { CortiUIMessage } from '../types.js';

describe('toA2AMessages', () => {
  it('should convert basic message structures with role mapping', () => {
    // Test 1: User message conversion
    let uiMessages: CortiUIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
      },
    ];
    let a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages).toHaveLength(1);
    expect(a2aMessages[0]).toMatchObject({
      kind: 'message',
      role: 'user',
      parts: [{ kind: 'text', text: 'Hello' }],
    });
    expect(a2aMessages[0].messageId).toBeDefined();

    // Test 2: Assistant to agent role mapping
    uiMessages = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hi there' }],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].role).toBe('agent');

    // Test 3: Filter system messages
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
    expect(a2aMessages[0].role).toBe('user');

    // Test 4: Multiple messages
    uiMessages = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
      },
      {
        id: 'msg-2',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hi' }],
      },
      {
        id: 'msg-3',
        role: 'user',
        parts: [{ type: 'text', text: 'How are you?' }],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages).toHaveLength(3);
    expect(a2aMessages[0].role).toBe('user');
    expect(a2aMessages[1].role).toBe('agent');
    expect(a2aMessages[2].role).toBe('user');

    // Test 5: Empty array and empty parts
    expect(toA2AMessages([])).toHaveLength(0);
    uiMessages = [{ id: 'msg-1', role: 'user', parts: [] }];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts).toHaveLength(0);
  });

  it('should convert text and data-text parts correctly', () => {
    // Test 1: Single text part
    let uiMessages: CortiUIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello world' }],
      },
    ];
    let a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts).toMatchObject([
      { kind: 'text', text: 'Hello world' },
    ]);

    // Test 2: Multiple text parts
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
    expect(a2aMessages[0].parts[0]).toMatchObject({ kind: 'text', text: 'First part' });
    expect(a2aMessages[0].parts[1]).toMatchObject({ kind: 'text', text: 'Second part' });

    // Test 3: data-text converts to text
    uiMessages = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'data-text', data: 'Text from data' }],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts).toMatchObject([
      { kind: 'text', text: 'Text from data' },
    ]);

    // Test 4: Mixed text and data-text
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
    expect(a2aMessages[0].parts[0]).toMatchObject({ kind: 'text', text: 'Regular text' });
    expect(a2aMessages[0].parts[1]).toMatchObject({ kind: 'text', text: 'Data text' });
  });

  it('should convert data-json parts to data kind', () => {
    // Test 1: Object data
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
    expect(a2aMessages[0].parts).toMatchObject([
      {
        kind: 'data',
        data: { key: 'value', number: 42, nested: { prop: true } },
      },
    ]);

    // Test 2: Array data
    uiMessages = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'data-json', data: [1, 2, 3] }],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts[0]).toMatchObject({
      kind: 'data',
      data: [1, 2, 3],
    });

    // Test 3: Complex nested structure
    const complexData = {
      users: [
        { id: 1, name: 'Alice', active: true },
        { id: 2, name: 'Bob', active: false },
      ],
      metadata: {
        total: 2,
        filters: { status: 'all' },
      },
    };
    uiMessages = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'data-json', data: complexData }],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts[0]).toMatchObject({
      kind: 'data',
      data: complexData,
    });

    // Test 4: null/undefined values
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
    expect(a2aMessages[0].parts[0]).toMatchObject({ kind: 'data', data: null });
    expect(a2aMessages[0].parts[1]).toMatchObject({ kind: 'data', data: undefined });
  });

  it('should convert file parts based on URL format', () => {
    // Test 1: HTTP URL as URI
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
      kind: 'file',
      file: {
        mimeType: 'application/pdf',
        uri: 'http://example.com/document.pdf',
        name: 'file',
      },
    });

    // Test 2: HTTPS URL as URI
    uiMessages = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [
          {
            type: 'file',
            mediaType: 'image/png',
            url: 'https://example.com/image.png',
          },
        ],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts[0]).toMatchObject({
      kind: 'file',
      file: {
        uri: 'https://example.com/image.png',
      },
    });

    // Test 3: base64 data URL as bytes
    const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    uiMessages = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [
          {
            type: 'file',
            mediaType: 'image/png',
            url: `data:image/png;base64,${base64Data}`,
          },
        ],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts).toMatchObject([
      {
        kind: 'file',
        file: {
          mimeType: 'image/png',
          bytes: base64Data,
          name: 'file',
        },
      },
    ]);

    // Test 4: JSON data URL as data kind
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
    expect(a2aMessages[0].parts).toMatchObject([
      {
        kind: 'data',
        data: jsonData,
      },
    ]);

    // Test 5: Unsupported URL formats throw errors
    expect(() =>
      toA2AMessages([
        {
          id: 'msg-1',
          role: 'user',
          parts: [
            {
              type: 'file',
              mediaType: 'image/png',
              url: 'file:///local/path/image.png',
            },
          ],
        },
      ])
    ).toThrow('Unsupported file URL format');

    expect(() =>
      toA2AMessages([
        {
          id: 'msg-1',
          role: 'user',
          parts: [
            {
              type: 'file',
              mediaType: 'text/plain',
              url: 'data:text/plain,Hello%20World',
            },
          ],
        },
      ])
    ).toThrow('Unsupported file URL format');
  });

  it('should handle mixed part types and filter unsupported types', () => {
    // Test 1: All supported types together
    const uiMessages: CortiUIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [
          { type: 'text', text: 'Check this out' },
          {
            type: 'file',
            mediaType: 'application/pdf',
            url: 'https://example.com/doc.pdf',
          },
          { type: 'data-json', data: { note: 'important' } },
          { type: 'data-text', data: 'Extra info' },
        ],
      },
    ];
    let a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts).toHaveLength(4);
    expect(a2aMessages[0].parts[0].kind).toBe('text');
    expect(a2aMessages[0].parts[1].kind).toBe('file');
    expect(a2aMessages[0].parts[2].kind).toBe('data');
    expect(a2aMessages[0].parts[3].kind).toBe('text');

    // Test 2: Unsupported types are filtered out
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
    expect(a2aMessages[0].parts[0]).toMatchObject({ kind: 'text', text: 'Hello' });
    expect(a2aMessages[0].parts[1]).toMatchObject({ kind: 'data', data: { valid: true } });
  });

  it('should support custom ID generation', () => {
    // Test 1: Custom generateId function
    let counter = 0;
    const customGenerateId = vi.fn(() => `custom-id-${++counter}`);
    const uiMessages: CortiUIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'First' }],
      },
      {
        id: 'msg-2',
        role: 'user',
        parts: [{ type: 'text', text: 'Second' }],
      },
    ];
    let a2aMessages = toA2AMessages(uiMessages, { generateId: customGenerateId });
    expect(customGenerateId).toHaveBeenCalledTimes(2);
    expect(a2aMessages[0].messageId).toBe('custom-id-1');
    expect(a2aMessages[1].messageId).toBe('custom-id-2');

    // Test 2: Default generateId creates valid IDs
    a2aMessages = toA2AMessages([{ id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }]);
    expect(a2aMessages[0].messageId).toBeDefined();
    expect(typeof a2aMessages[0].messageId).toBe('string');
    expect(a2aMessages[0].messageId.length).toBeGreaterThan(0);
  });

  it('should handle edge cases correctly', () => {
    // Test 1: Metadata is not converted to A2A format
    let uiMessages: CortiUIMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Response' }],
        metadata: {
          contextId: 'ctx-123',
          taskId: 'task-456',
          state: 'completed',
        },
      },
    ];
    let a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0]).toMatchObject({
      kind: 'message',
      role: 'agent',
      parts: [{ kind: 'text', text: 'Response' }],
    });
    expect('metadata' in a2aMessages[0]).toBe(false);

    // Test 2: Empty text parts
    uiMessages = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: '' }],
      },
    ];
    a2aMessages = toA2AMessages(uiMessages);
    expect(a2aMessages[0].parts).toMatchObject([
      { kind: 'text', text: '' },
    ]);

    // Test 3: No mutation of input
    uiMessages = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
      },
    ];
    const originalRole = uiMessages[0].role;
    const originalPartsLength = uiMessages[0].parts.length;
    toA2AMessages(uiMessages);
    expect(uiMessages[0].role).toBe(originalRole);
    expect(uiMessages[0].parts).toHaveLength(originalPartsLength);
  });
});
