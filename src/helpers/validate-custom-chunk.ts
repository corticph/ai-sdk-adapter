import type { CustomDataChunk } from '../types.js';

export function validateCustomChunk(chunk: unknown): chunk is CustomDataChunk {
  if (!chunk || typeof chunk !== 'object') return false;

  const candidate = chunk as Record<string, unknown>;
  return (
    typeof candidate.type === 'string' &&
    candidate.type.startsWith('data-') &&
    candidate.type.length > 5 &&
    'data' in candidate &&
    (candidate.id === undefined || typeof candidate.id === 'string') &&
    (candidate.transient === undefined || typeof candidate.transient === 'boolean')
  );
}
