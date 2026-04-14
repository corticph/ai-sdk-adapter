import {
  ClientFactory,
  DefaultAgentCardResolver,
  JsonRpcTransportFactory,
} from '@a2a-js/sdk/client';
import type { CortiClient } from '@corti/sdk';
import { mergeHeaders } from './helpers/merge-headers.js';

/**
 * Creates a fetch implementation that automatically includes authentication headers for the Corti API.
 *
 * @param client - An authenticated Corti client instance
 * @returns A fetch function that wraps the native fetch API with automatic auth header injection
 *
 */
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
 * This factory is pre-configured with JSON-RPC transport and a default agent card resolver,
 * both using authenticated fetch implementation derived from the provided Corti client.
 *
 * @param client - An authenticated Corti client instance
 * @returns A configured ClientFactory instance ready to create A2A clients
 *
 * @example
 * const corti = new CortiClient({
 *   tenantName: process.env.TENANT,
 *   environment,
 *   auth: {
 *     clientId: process.env.CLIENT_ID,
 *     clientSecret: process.env.CLIENT_SECRET,
 *   },
 * });
 *
 * const factory = createA2AClientFactory(corti);
 * const agentUrl = await corti.agents.getCardUrl('your-agent-id');
 * const client = factory.createFromUrl(agentUrl, "");
 */
function createA2AClientFactory(client: CortiClient) {
  const fetchImpl = createFetchImplementation(client);
  const factory = new ClientFactory({
    transports: [new JsonRpcTransportFactory({ fetchImpl })],
    cardResolver: new DefaultAgentCardResolver({ fetchImpl }),
  });

  return factory;
}

export { createFetchImplementation, createA2AClientFactory };
