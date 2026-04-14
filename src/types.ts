import type { Message, Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent } from '@a2a-js/sdk';
import type { Client } from '@a2a-js/sdk/client';
import type { JSONValue } from '@ai-sdk/provider';
import type { UIDataTypes, UIMessage, UIMessageChunk, UITools } from 'ai';

// ============================================================================
// A2A Stream Types
// ============================================================================

/**
 * Event data type from A2A stream.
 * Inferred from the stream returned by client.sendMessageStream().
 */
export type A2AStreamEventData = ReturnType<Client['sendMessageStream']> extends AsyncGenerator<
  infer T,
  unknown,
  unknown
>
  ? T
  : never;

// ============================================================================
// Authentication & Credentials
// ============================================================================

/**
 * Credential configuration for MCP servers.
 * Supports both bearer tokens and OAuth 2.0 credentials.
 */
export type ExpertCredential =
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
 * Custom data part type for json parts
 */

export type CortiJSONPart = JSONValue;

/**
 * Custom data part type for text parts
 */

export type CortiTextPart = string;

/**
 * Custom data part type for status update events
 */

export type CortiStatusUpdate = {
  state: string;
  message?: string;
};

/**
 * Custom data part types for Corti UI messages.
 */
export type CortiMessageDataTypes = {
  text: CortiTextPart;
  json: CortiJSONPart;
  'status-update': CortiStatusUpdate;
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
  TAdditionalDataTypes extends UIDataTypes = UIDataTypes,
  TTools extends UITools = UITools,
> = UIMessage<
  CortiMessageMetadata & TAdditionalMetadata,
  CortiMessageDataTypes & TAdditionalDataTypes,
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
  TAdditionalDataTypes extends UIDataTypes = UIDataTypes,
> = UIMessageChunk<
  CortiMessageMetadata & TAdditionalMetadata,
  CortiMessageDataTypes & TAdditionalDataTypes
>;

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
export interface ResponseMetadata {
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

// ============================================================================
// Stream Callbacks & Options
// ============================================================================

/**
 * Lifecycle callbacks for A2A stream processing.
 * Similar to LangChain adapter callbacks.
 */
export interface StreamCallbacks<TState = Task | Message> {
  /**
   * Called when the stream initializes.
   */
  onStart?(): void;

  /**
   * Called on successful stream completion with final state.
   * For A2A streams, the state is the final Task or Message.
   */
  onFinish?(state: TState | undefined): void;

  /**
   * Called when the stream encounters an error.
   */
  onError?(error: Error): void;

  /**
   * Called on each new event from the stream.
   */
  onEvent?(event: Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent): void;

  /**
   * Called when the stream is aborted by the client.
   */
  onAbort?(): void;
}

/**
 * Options for configuring A2A stream conversion.
 */
export interface StreamConversionOptions<TState = Task | Message> {
  /**
   * Lifecycle callbacks for stream events.
   */
  callbacks?: StreamCallbacks<TState>;
}
