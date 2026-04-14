import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createA2AClientFactory, createFetchImplementation } from '../create-client-factory.js';
import type { CortiClient } from '@corti/sdk';

describe('createFetchImplementation', () => {
  let mockCortiClient: CortiClient;
  let mockGetAuthHeaders: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetAuthHeaders = vi.fn();
    mockCortiClient = {
      getAuthHeaders: mockGetAuthHeaders,
    } as unknown as CortiClient;
  });

  it('should inject auth headers and preserve user headers', async () => {
    const mockAuthHeaders = new Headers({
      'Authorization': 'Bearer test-token',
      'X-Custom-Header': 'custom-value',
    });
    mockGetAuthHeaders.mockResolvedValue(mockAuthHeaders);

    const fetchImpl = createFetchImplementation(mockCortiClient);
    const mockFetch = vi.fn().mockResolvedValue(new Response('OK'));
    global.fetch = mockFetch;

    // Test 1: Basic auth header injection
    await fetchImpl('https://api.example.com/test');
    expect(mockGetAuthHeaders).toHaveBeenCalled();
    let calledHeaders = mockFetch.mock.calls[0][1]?.headers as Headers;
    expect(calledHeaders.get('Authorization')).toBe('Bearer test-token');
    expect(calledHeaders.get('X-Custom-Header')).toBe('custom-value');

    // Test 2: Preserve original user headers
    mockFetch.mockClear();
    await fetchImpl('https://api.example.com/test', {
      headers: {
        'Content-Type': 'application/json',
        'X-User-Header': 'user-value',
      },
    });
    calledHeaders = mockFetch.mock.calls[0][1]?.headers as Headers;
    expect(calledHeaders.get('Authorization')).toBe('Bearer test-token');
    expect(calledHeaders.get('Content-Type')).toBe('application/json');
    expect(calledHeaders.get('X-User-Header')).toBe('user-value');

    // Test 3: Auth headers override conflicting user headers
    mockFetch.mockClear();
    mockGetAuthHeaders.mockResolvedValue(new Headers({
      'Authorization': 'Bearer correct-token',
    }));
    await fetchImpl('https://api.example.com/test', {
      headers: {
        'Authorization': 'Bearer wrong-token',
      },
    });
    calledHeaders = mockFetch.mock.calls[0][1]?.headers as Headers;
    expect(calledHeaders.get('Authorization')).toBe('Bearer correct-token');

    // Test 4: Handle empty auth headers
    mockGetAuthHeaders.mockResolvedValue(new Headers());
    mockFetch.mockClear();
    await fetchImpl('https://api.example.com/test', {
      headers: { 'Content-Type': 'application/json' },
    });
    calledHeaders = mockFetch.mock.calls[0][1]?.headers as Headers;
    expect(calledHeaders.get('Authorization')).toBeNull();
    expect(calledHeaders.get('Content-Type')).toBe('application/json');
  });

  it('should support various input types and options', async () => {
    const mockAuthHeaders = new Headers({
      'Authorization': 'Bearer test-token',
    });
    mockGetAuthHeaders.mockResolvedValue(mockAuthHeaders);

    const fetchImpl = createFetchImplementation(mockCortiClient);
    const mockFetch = vi.fn().mockResolvedValue(new Response('OK'));
    global.fetch = mockFetch;

    // Test 1: URL object
    const url = new URL('https://api.example.com/test');
    await fetchImpl(url);
    expect(mockFetch).toHaveBeenCalledWith(url, expect.any(Object));

    // Test 2: Request object
    mockFetch.mockClear();
    const request = new Request('https://api.example.com/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    await fetchImpl(request);
    expect(mockFetch).toHaveBeenCalledWith(request, expect.any(Object));
    const calledHeaders = mockFetch.mock.calls[0][1]?.headers as Headers;
    expect(calledHeaders.get('Authorization')).toBe('Bearer test-token');

    // Test 3: Preserve other init options (method, body, signal)
    mockFetch.mockClear();
    await fetchImpl('https://api.example.com/test', {
      method: 'POST',
      body: JSON.stringify({ data: 'test' }),
      signal: new AbortController().signal,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ data: 'test' }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('should propagate fetch errors', async () => {
    mockGetAuthHeaders.mockResolvedValue(new Headers({
      'Authorization': 'Bearer test-token',
    }));

    const fetchImpl = createFetchImplementation(mockCortiClient);
    const mockError = new Error('Network error');
    global.fetch = vi.fn().mockRejectedValue(mockError);

    await expect(fetchImpl('https://api.example.com/test')).rejects.toThrow('Network error');
  });
});

describe('createA2AClientFactory', () => {
  let mockCortiClient: CortiClient;
  let mockGetAuthHeaders: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetAuthHeaders = vi.fn().mockResolvedValue(
      new Headers({
        'Authorization': 'Bearer test-token',
      }),
    );
    mockCortiClient = {
      getAuthHeaders: mockGetAuthHeaders,
    } as unknown as CortiClient;
  });

  it('should create configured factory with authenticated fetch', async () => {
    // Test 1: Factory creation and structure
    const factory = createA2AClientFactory(mockCortiClient);
    expect(factory).toBeDefined();
    expect(factory.createFromUrl).toBeDefined();
    expect(typeof factory.createFromUrl).toBe('function');

    // Test 2: Factories are independent instances
    const factory2 = createA2AClientFactory(mockCortiClient);
    expect(factory).not.toBe(factory2);

    // Test 3: Factory uses authenticated fetch for agent card retrieval
    const mockAgentCard = {
      name: 'Test Agent',
      version: '1.0.0',
      capabilities: {},
    };
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockAgentCard), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    global.fetch = mockFetch;

    try {
      await factory.createFromUrl('https://example.com/agent-card.json', '');
    } catch (error) {
      // Expected to fail without complete agent card structure
    }

    // Verify authenticated fetch was used
    expect(mockGetAuthHeaders).toHaveBeenCalled();
  });
});
