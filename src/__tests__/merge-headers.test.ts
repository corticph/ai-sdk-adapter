import { describe, it, expect } from 'vitest';
import { mergeHeaders } from '../helpers/merge-headers.js';

describe('mergeHeaders', () => {
  it('should merge plain objects', () => {
    const result = mergeHeaders(
      { 'Content-Type': 'application/json' },
      { Authorization: 'Bearer token' },
    );

    expect(result.get('Content-Type')).toBe('application/json');
    expect(result.get('Authorization')).toBe('Bearer token');
  });

  it('should merge Headers objects', () => {
    const headers1 = new Headers({ 'Content-Type': 'application/json' });
    const headers2 = new Headers({ Authorization: 'Bearer token' });

    const result = mergeHeaders(headers1, headers2);

    expect(result.get('Content-Type')).toBe('application/json');
    expect(result.get('Authorization')).toBe('Bearer token');
  });

  it('should merge arrays of tuples', () => {
    const result = mergeHeaders(
      [
        ['Content-Type', 'application/json'],
        ['Authorization', 'Bearer token'],
      ],
      [['X-Custom-Header', 'value']],
    );

    expect(result.get('Content-Type')).toBe('application/json');
    expect(result.get('Authorization')).toBe('Bearer token');
    expect(result.get('X-Custom-Header')).toBe('value');
  });

  it('should merge mixed source types', () => {
    const result = mergeHeaders(
      { 'Content-Type': 'application/json' },
      new Headers({ Authorization: 'Bearer token' }),
      [['X-Custom-Header', 'value']],
    );

    expect(result.get('Content-Type')).toBe('application/json');
    expect(result.get('Authorization')).toBe('Bearer token');
    expect(result.get('X-Custom-Header')).toBe('value');
  });

  it('should handle undefined sources', () => {
    const result = mergeHeaders(undefined, { 'Content-Type': 'application/json' }, undefined, {
      Authorization: 'Bearer token',
    });

    expect(result.get('Content-Type')).toBe('application/json');
    expect(result.get('Authorization')).toBe('Bearer token');
  });

  it('should give precedence to later sources', () => {
    const result = mergeHeaders(
      { 'Content-Type': 'text/plain' },
      { 'Content-Type': 'application/json' },
      new Headers({ 'Content-Type': 'application/xml' }),
    );

    expect(result.get('Content-Type')).toBe('application/xml');
  });

  it('should return empty Headers when no sources provided', () => {
    const result = mergeHeaders();

    expect([...result.keys()].length).toBe(0);
  });

  it('should return empty Headers when all sources are undefined', () => {
    const result = mergeHeaders(undefined, undefined, undefined);

    expect([...result.keys()].length).toBe(0);
  });

  it('should handle empty sources gracefully', () => {
    const result = mergeHeaders({}, new Headers(), []);

    expect([...result.keys()].length).toBe(0);
  });

  it('should ignore non-string values in plain objects', () => {
    const result = mergeHeaders(
      // @ts-expect-error - Testing runtime behavior with invalid values
      {
        'Content-Type': 'application/json',
        'Invalid-Number': 123,
        'Invalid-Object': { nested: 'value' },
        'Valid-Header': 'value',
      },
    );

    expect(result.get('Content-Type')).toBe('application/json');
    expect(result.get('Valid-Header')).toBe('value');
    expect(result.get('Invalid-Number')).toBeNull();
    expect(result.get('Invalid-Object')).toBeNull();
  });

  it('should handle arrays with incomplete tuples', () => {
    const result = mergeHeaders([
      ['Complete-Header', 'value'],
      ['Incomplete-Header'] as unknown as [string, string], // Missing value
      ['Another-Complete', 'value2'],
    ]);

    expect(result.get('Complete-Header')).toBe('value');
    expect(result.get('Another-Complete')).toBe('value2');
    expect(result.get('Incomplete-Header')).toBeNull();
  });

  it('should handle case-insensitive header names correctly', () => {
    const result = mergeHeaders(
      { 'content-type': 'text/plain' },
      { 'Content-Type': 'application/json' },
    );

    // Headers are case-insensitive, so the second one should overwrite
    expect(result.get('content-type')).toBe('application/json');
    expect(result.get('Content-Type')).toBe('application/json');
  });

  it('should work with real-world fetch scenario', () => {
    const requestHeaders = new Headers({ 'User-Agent': 'MyApp/1.0' });
    const initHeaders = { 'Content-Type': 'application/json' };
    const authHeaders = Object.fromEntries([
      ['Authorization', 'Bearer secret-token'],
      ['X-API-Key', 'api-key-123'],
    ]);

    const result = mergeHeaders(requestHeaders, initHeaders, authHeaders);

    expect(result.get('User-Agent')).toBe('MyApp/1.0');
    expect(result.get('Content-Type')).toBe('application/json');
    expect(result.get('Authorization')).toBe('Bearer secret-token');
    expect(result.get('X-API-Key')).toBe('api-key-123');
  });
});
