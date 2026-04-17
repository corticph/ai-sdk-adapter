/**
 * Merges multiple header sources into a single Headers object.
 * Handles Headers objects, plain objects, and arrays of tuples.
 * Later sources take precedence over earlier ones.
 *
 * @param sources - Array of header sources to merge
 * @returns A new Headers object with all headers merged
 *
 * @example
 * ```typescript
 * const headers = mergeHeaders(
 *   { 'Content-Type': 'application/json' },
 *   new Headers({ 'Authorization': 'Bearer token' }),
 *   [['X-Custom', 'value']]
 * );
 * ```
 */
export function mergeHeaders(...sources: (RequestInit['headers'] | undefined)[]): Headers {
  const result = new Headers();

  for (const source of sources) {
    if (!source) continue;

    if (source instanceof Headers) {
      source.forEach((value, key) => {
        result.set(key, value);
      });
    } else if (Array.isArray(source)) {
      for (const entry of source) {
        if (entry.length >= 2) {
          result.set(entry[0], entry[1]);
        }
      }
    } else {
      for (const [key, value] of Object.entries(source)) {
        if (typeof value === 'string') {
          result.set(key, value);
        }
      }
    }
  }

  return result;
}
