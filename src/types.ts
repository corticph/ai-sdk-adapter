import type { Message, Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent } from '@a2a-js/sdk';
import type { JSONValue } from '@ai-sdk/provider';
import type { UIDataTypes, UIMessage, UIMessageChunk, UITools } from 'ai';

// ============================================================================
// Authentication & Credentials
// ============================================================================

/**
 * Credential configuration for MCP servers.
 * Supports both bearer tokens and OAuth 2.0 credentials.
 */
export type ChatCredential =
  | {
      /** MCP server name */
      mcp_name: string;
      /** Bearer token */
      token: string;
      /** Authentication type */
      type: 'bearer';
    }
  | {
      /** MCP server name */
      mcp_name: string;
      /** OAuth client ID */
      client_id: string;
      /** OAuth client secret */
      client_secret: string;
      /** Authentication type */
      type: 'oauth2.0';
    };

// ============================================================================
// UI Message Types
// ============================================================================

/**
 * A2A-specific metadata included in UI messages and chunks.
 */
export type CortiMessageMetadata = {
  contextId?: string;
  taskId?: string;
  history?: boolean;
  credits?: number;
  state?: string;
};

/**
 * Custom data part types for Corti A2A messages.
 */
export type CortiMessageData = {
  text: {
    name: string;
    text: string;
  };
  json: {
    name: string;
    content: JSONValue;
  };
  'status-update': {
    state: string;
    message?: string;
  };
};

/**
 * Custom UI message type for Corti A2A agents.
 * Extends the standard UIMessage with A2A-specific metadata and custom data types.
 *
 * @template TAdditionalMetadata - Additional user-defined metadata fields
 * @template TAdditionalData - Additional user-defined data part types
 * @template TTools - Tool definitions (currently unused)
 *
 * @example
 * ```typescript
 * // Use with base types only
 * type Message = CortiUIMessage;
 *
 * // Extend with custom metadata and data
 * type ExtendedMessage = CortiUIMessage<
 *   { sessionId: string },  // Additional metadata
 *   { 'custom-event': { value: number } }  // Additional data types
 * >;
 * ```
 */
export type CortiUIMessage<
  TAdditionalMetadata = unknown,
  TAdditionalData extends UIDataTypes = UIDataTypes,
  TTools extends UITools = UITools,
> = UIMessage<
  CortiMessageMetadata & TAdditionalMetadata,
  CortiMessageData & TAdditionalData,
  TTools
>;

/**
 * Chunk type for streaming Corti UI messages.
 * Compatible with CortiUIMessage metadata and data types.
 *
 * @template TAdditionalMetadata - Additional user-defined metadata fields
 * @template TAdditionalData - Additional user-defined data part types
 *
 * @example
 * ```typescript
 * // Use with base types only
 * type Chunk = CortiUIMessageChunk;
 *
 * // Extend with custom metadata and data
 * type ExtendedChunk = CortiUIMessageChunk<
 *   { sessionId: string },  // Additional metadata
 *   { 'custom-event': { value: number } }  // Additional data types
 * >;
 * ```
 */
export type CortiUIMessageChunk<
  TAdditionalMetadata = unknown,
  TAdditionalData extends UIDataTypes = UIDataTypes,
> = UIMessageChunk<CortiMessageMetadata & TAdditionalMetadata, CortiMessageData & TAdditionalData>;

// ============================================================================
// Adapter Response Types
// ============================================================================

/**
 * A2A-specific metadata included in adapter responses.
 *
 * This is a simplified metadata structure extracted from A2A responses,
 * designed for the adapter's public API. It differs from the raw SDK types
 * by providing a consistent, flattened interface for both Task and Message responses.
 */
export interface A2AMetadata {
  /**
   * Context ID for maintaining conversation continuity.
   */
  contextId: string;

  /**
   * Task ID if the task is still ongoing.
   */
  taskId: string;

  /**
   * Credits consumed by the request.
   */
  credits: number;

  /**
   * Current state of the task.
   */
  state: string;
}

/**
 * Response format for non-streaming A2A responses.
 *
 * This is the adapter's structured response format, not a direct SDK type.
 * It provides a simplified, consistent interface for working with A2A responses
 * in non-streaming scenarios.
 */
export interface A2AResponse {
  /**
   * Message content parts (text, files, etc.).
   */
  content: Array<{
    type: 'text' | 'file';
    text?: string;
    data?: Uint8Array | string;
    mediaType?: string;
  }>;

  /**
   * A2A-specific metadata.
   */
  metadata: A2AMetadata;
}

// ============================================================================
// Stream Callbacks & Options
// ============================================================================

/**
 * Type representing possible A2A stream event data.
 */
export type A2AStreamEventData = Task | Message | TaskStatusUpdateEvent | TaskArtifactUpdateEvent;

/**
 * Lifecycle callbacks for A2A stream processing.
 * Similar to LangChain adapter callbacks.
 */
export interface StreamCallbacks<TState = Task | Message> {
  /**
   * Called when the stream initializes.
   */
  onStart?(): void | Promise<void>;

  /**
   * Called for each token received.
   */
  onToken?(token: string): void | Promise<void>;

  /**
   * Called for each text chunk received.
   */
  onText?(text: string): void | Promise<void>;

  /**
   * Called with aggregated text on success, error, or abort.
   */
  onFinal?(text: string): void | Promise<void>;

  /**
   * Called on successful stream completion with final state.
   * For A2A streams, the state is the final Task or Message.
   */
  onFinish?(state: TState | undefined): void | Promise<void>;

  /**
   * Called when the stream encounters an error.
   */
  onError?(error: Error): void | Promise<void>;

  /**
   * Called when the stream is aborted by the client.
   */
  onAbort?(): void | Promise<void>;
}

/**
 * Options for configuring A2A stream conversion.
 */
export interface A2AStreamOptions<TState = Task | Message> {
  /**
   * Lifecycle callbacks for stream events.
   */
  callbacks?: StreamCallbacks<TState>;
}
