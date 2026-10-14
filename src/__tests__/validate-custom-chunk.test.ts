import { describe, expect, it } from 'vitest';
import { validateCustomChunk } from '../helpers/validate-custom-chunk.js';

describe('validateCustomChunk', () => {
  it.each([
    { name: 'custom data type', chunk: { type: 'data-custom', data: { ready: true } } },
    { name: 'single-character suffix', chunk: { type: 'data-x', data: 1 } },
    { name: 'null data', chunk: { type: 'data-json', data: null } },
    { name: 'explicit undefined data', chunk: { type: 'data-json', data: undefined } },
    { name: 'string id', chunk: { type: 'data-json', data: {}, id: 'part-1' } },
    { name: 'empty id', chunk: { type: 'data-json', data: {}, id: '' } },
    { name: 'transient true', chunk: { type: 'data-json', data: {}, transient: true } },
    { name: 'transient false', chunk: { type: 'data-json', data: {}, transient: false } },
    {
      name: 'explicit undefined optional fields',
      chunk: { type: 'data-json', data: {}, id: undefined, transient: undefined },
    },
    {
      name: 'both optional fields',
      chunk: { type: 'data-json', data: {}, id: 'part-1', transient: true },
    },
  ])('should accept $name', ({ chunk }) => {
    expect(validateCustomChunk(chunk)).toBe(true);
  });

  it.each([
    { name: 'undefined', chunk: undefined },
    { name: 'null', chunk: null },
    { name: 'boolean', chunk: false },
    { name: 'number', chunk: 1 },
    { name: 'string', chunk: 'data-json' },
    { name: 'array', chunk: [] },
    { name: 'empty object', chunk: {} },
    { name: 'missing type', chunk: { data: {} } },
    { name: 'non-string type', chunk: { type: 1, data: {} } },
    { name: 'lifecycle chunk', chunk: { type: 'finish', data: {} } },
    { name: 'text chunk', chunk: { type: 'text-delta', id: 'text', delta: 'text' } },
    { name: 'empty suffix', chunk: { type: 'data-', data: {} } },
    { name: 'incorrect prefix', chunk: { type: 'custom-data-json', data: {} } },
    { name: 'missing data', chunk: { type: 'data-json' } },
    { name: 'numeric id', chunk: { type: 'data-json', data: {}, id: 1 } },
    { name: 'null id', chunk: { type: 'data-json', data: {}, id: null } },
    { name: 'string transient', chunk: { type: 'data-json', data: {}, transient: 'true' } },
    { name: 'null transient', chunk: { type: 'data-json', data: {}, transient: null } },
  ])('should reject $name', ({ chunk }) => {
    expect(validateCustomChunk(chunk)).toBe(false);
  });
});
