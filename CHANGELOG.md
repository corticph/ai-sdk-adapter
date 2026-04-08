# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-03-26

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

[Unreleased]: https://github.com/corticph/ai-sdk-adapter/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/corticph/ai-sdk-adapter/releases/tag/v0.1.0
