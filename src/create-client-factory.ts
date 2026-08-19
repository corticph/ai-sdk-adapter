import {
  ClientFactory,
  ClientFactoryOptions,
  DefaultAgentCardResolver,
  JsonRpcTransportFactory,
} from '@a2a-js/sdk/client';
import type { CortiClient } from '@corti/sdk';
import { mergeHeaders } from './helpers/merge-headers.js';

function createFetchImplementation(client: CortiClient) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const headers = mergeHeaders(
      input instanceof Request ? input.headers : undefined,
      init?.headers,
      Object.fromEntries(await client.getAuthHeaders()),
    );

    return fetch(input, {
      ...init,
      headers,
    });
  };
}

/**
 * Creates an A2A (Agent-to-Agent) client factory configured with Corti authentication.
 *
 * Pre-configured with JSON-RPC transport and a default agent card resolver,
 * both using authenticated fetch. Legacy compatibility with A2A v0.3 servers
 * is enabled by default so the factory works with both v1 and v2 Corti APIs.
 *
 * @param client - An authenticated Corti client instance
 * @param options - Optional additional client factory options to merge with the defaults
 * @returns A configured ClientFactory instance ready to create A2A clients
 */
function createA2AClientFactory(client: CortiClient, options?: Partial<ClientFactoryOptions>) {
  const fetchImpl = createFetchImplementation(client);
  const legacyCompat = { enabled: true };
  const defaults: ClientFactoryOptions = {
    transports: [new JsonRpcTransportFactory({ fetchImpl, legacyCompat })],
    cardResolver: new DefaultAgentCardResolver({ fetchImpl, legacyCompat }),
  };
  const merged = options ? ClientFactoryOptions.createFrom(defaults, options) : defaults;

  return new ClientFactory(merged);
}

export { createFetchImplementation, createA2AClientFactory };
