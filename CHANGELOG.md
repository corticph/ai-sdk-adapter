# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `createA2AClientFactory` function to create A2A client factories with automatic Corti authentication
- `createFetchImplementation` helper function for creating authenticated fetch wrappers
- Comprehensive unit test suite for all core modules (convert-to-params, create-client-factory, to-ui-message-stream, to-a2a-messages)
- Integration test suite with real Corti agents validating end-to-end flows
- Environment variable configuration support for integration tests via dotenv
- CI workflow with automated compile, lint, test, and publish jobs
- Support for publishing prerelease versions with custom npm tags
- Node.js 20 specified as the runtime version for CI

### Changed

- Renamed `buildParams` to `convertToParams` for clarity
- Renamed `ChatCredential` to `ExpertCredential`
- Renamed `CortiMessageData` to `CortiMessageDataTypes`
- Renamed `A2AMetadata` to `ResponseMetadata`
- Renamed `A2AStreamOptions` to `StreamConversionOptions`
- Moved `toA2AMessages` helper to helpers directory
- Bumped `@corti/sdk` to `^1.0.0-rc.6` to match peerDependencies
- Simplified callback types and improved type organization in types.ts
- Fixed CI workflow to use `vars.CLIENT_ID` for repository variables
- Switched from npm to pnpm as the package manager
- Added `packageManager` field to package.json specifying pnpm@9.0.0
- Updated all package scripts to use pnpm instead of npm

### Removed

- `convertA2AResponse` function (synchronous implementation no longer supported)
- `A2AResponse` type export
- `A2AStreamEventData` type export

## [0.1.1] - 2026-04-08

### Fixed

- Corrected package.json entry points to match actual build output (index.js for ESM, index.cjs for CommonJS)
- Updated main field to point to dist/index.cjs instead of dist/index.js
- Updated module field to point to dist/index.js instead of dist/index.mjs
- Updated exports import/require mappings to use correct file extensions

## [0.1.0] - 2026-03-26

### Changed

- Updated README with correct usage examples showing adapter functions (`buildParams`, `toUIMessageStream`, `convertA2AResponse`) instead of incorrect provider pattern
- Improved documentation with streaming and non-streaming examples
- Added "How It Works" section explaining context and task continuity
- Clarified package purpose as an adapter, not a traditional AI SDK provider

## [0.0.0] - 2026-03-26

### Added

- Initial release of @corti/ai-sdk-adapter
- Support for Corti A2A agents API integration
- Chat model implementation with doGenerate and doStream support
- Custom CortiUIMessage type export
- Support for A2A-specific metadata (contextId, taskId, credits)
- Bearer token and OAuth 2.0 credential handling
- Runtime support for Node.js and Edge runtimes
- Comprehensive TypeScript type definitions
- Provider options for context and task continuity

### Known Limitations

- Tool support not yet implemented
- toCortiUIMessageStream implementation deferred to future release

[0.1.1]: https://github.com/corticph/ai-sdk-adapter/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/corticph/ai-sdk-adapter/releases/tag/v0.1.0
