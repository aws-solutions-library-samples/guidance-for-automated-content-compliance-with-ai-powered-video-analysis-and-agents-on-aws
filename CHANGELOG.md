# Changelog

All notable changes to this project will be documented in this file.

## [1.4.0] - 2026-06-18

### Added
- Added Claude Opus 4.7 and Opus 4.8 as frame analysis options

### Changed
- Opus 4.7 and 4.8 do not use the `temperature`, `top_p`, or `top_k` sampling parameters (the models have deprecated them); they are omitted from frame analysis requests and hidden in the Config page for these models

## [1.3.0] - 2026-03-31

### Added
- Mimir MAM integration: inbound custom action handler downloads videos from Mimir via presigned URL and triggers the compliance workflow
- Push to Mimir: timeline compliance data can be pushed back to Mimir as timed metadata from the Timeline Report tab
- Mimir item ID threaded through the workflow via S3 object tags and stored in DynamoDB for round-trip integration
- API Gateway API key auth for the `/mimir-action` endpoint (replaces Cognito auth for external Mimir requests)
- Setup script (`scripts/setup-mimir.sh`) for configuring Mimir secrets in SSM
- `mimirItemId` field on `VideoAnalysisResults` model and GraphQL queries

## [1.2.0] - 2026-03-28

### Changed
- Enhanced profanity detection prompt with detailed guidelines for explicit profanity, suggestive language, innuendo, and context analysis

## [1.1.0] - 2026-03-12

### Added
- Added Sonnet 4.6 and Opus 4.6 for frame analysis options
- Added `getVideoAnalysisByJobId` query
- Added workflow time metric on analysis cost tab

### Changed
- Refactored nested stacks to minimize export dependencies
- Optimized frame selection (phash) and frame analysis to be much faster and more parallel
- Refactored step functions to be more parallel
- Updated agents to use Sonnet 4.6
- Optimized getting duration from ffmpeg
- Scoped IAM permissions toward least privilege: S3 policies restricted to solution bucket pattern, DynamoDB policies scoped to specific tables and indexes, MediaConvert role dropped hardcoded `roleName` and uses CDK-generated name

### Deprecated
- Sonnet 4.5

### Removed
- Removed shot analysis (optional in this workflow)

## [1.0.2] - 2025-12-21

### Added
- Added feature to delete analysis results from the UI
- Added Nova 2 Omni, Lite, Pro models
- Updated prompt for json output consistency across all models

## [1.0.1] - 2025-11-13

### Added
- Added models: TWELVE_LABS_PEGASUS_1_2, CLAUDE_4_5_SONNET
- Updated JSON agent to use Sonnet 4 since 3.7 is now deprecated

### Removed
- Removed deprecated models from being selectable

## [1.0.0] - 2025-09-07

### Added
- Initial release of Media Analysis Content Compliance Solution
- AWS Amplify Next.js application with authentication via Amazon Cognito
- Video analysis and content compliance checking capabilities
- Real-time database integration with Amazon DynamoDB
- GraphQL API with AWS AppSync
- Navigation interface with version display
- User authentication and session management
- Video library and analysis history tracking
- Statistics and reporting dashboard
- Configuration management interface
- Architecture overview page
