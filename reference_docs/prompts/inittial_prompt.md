<ignore>
Other information ignore:

npm run compile

npm run watch
</ignore>

--------------------------------

Please review my system prompt and the following documentation.

@small_project_description_starting_point.md
@sherpa-onnx-nodejs_ref_foundational.md
@sherpa-onnx1
@sherpa-onnx2
@codebase

Confirm that you understand the context and then acknowledge it.

# Project Context: TTS-STT for Cursor Extension Development

## Project Overview
We are developing a Visual Studio Code extension named "TTS-STT for Cursor," which integrates speech-to-text (STT) and text-to-speech (TTS) functionalities using the Sherpa-ONNX framework. This extension is being developed in TypeScript and leverages the sherpa-onnx-node native addon for integration. By utilizing the Node.js addon, the project benefits from native performance and multi-threading support, ensuring efficient and real-time processing of speech data directly within the VS Code environment. This approach allows for seamless integration and execution of Sherpa-ONNX capabilities, providing users with robust STT and TTS features without the need for external services or platform-specific binaries.

## Your Task

Your task is to analyze the codebase to:
- determine the development stage of the project
- identify possible gaps in the development
- based on the analysis of the codebase and the current challenge create a theory of what is causing the issue

Note: Do not actually attempt to fix the issue, only create a theory of what is causing the issue.

## Current Challenge
We are encountering initialization errors with Sherpa-onnx, specifically:
- Error message: "Please check your config!"

<debugging_logs>

Extension "TTS-STT for Cursor" is now active.

=== Starting Sherpa Initialization ===

Initializing models...
Model already extracted at: g:\_AI\coding _projects\tts-stt-cursor\models\stt\sherpa-onnx-streaming-zipformer-en-2023-06-26
Model already extracted at: g:\_AI\coding _projects\tts-stt-cursor\models\tts\vits-piper-en_US-amy-low
Retrieved current model for type 'stt': sherpa-onnx-streaming-zipformer-en-2023-06-26
Retrieved current model for type 'tts': vits-piper-en_US-amy-low

=== Creating Instances ===
Sherpa initialization error: Please check your config!
Failed to initialize Sherpa: Sherpa initialization failed: Please check your config!

=== Testing TTS Configuration ===
Model already extracted at: g:\_AI\coding _projects\tts-stt-cursor\models\stt\sherpa-onnx-streaming-zipformer-en-2023-06-26
Model already extracted at: g:\_AI\coding _projects\tts-stt-cursor\models\tts\vits-piper-en_US-amy-low
Retrieved current model for type 'tts': vits-piper-en_US-amy-low

❌ TTS Test Failed: Please check your config!

</debugging_logs>

<previous_session>

### Previous Session Overview 2024-11-16
During this development session, we focused on resolving initialization errors with the Sherpa-ONNX framework in our VS Code extension. The primary issue manifested as a "Please check your config!" error during the initialization phase.

#### Key Findings

#### Configuration Structure Analysis
1. **Model-Specific vs. Shared Configuration**
- We discovered that the project was using a shared configuration approach (`model_config.json`) for both STT and TTS models
- The TTS model already included its own configuration file (`en_US-amy-low.onnx.json`) with specific parameters
- The STT model relies on embedded metadata rather than external configuration

2. **Configuration Path Issues**
- TTS configuration was incorrectly pointing to a shared config instead of the model-specific JSON
- STT configuration included unnecessary `modelConfig` parameter
- Path resolution needed to be model-specific rather than using shared paths

#### Code Structure Improvements
1. **Type Safety**
- Implemented comprehensive interfaces for configurations
- Added proper type declarations for model information
- Enhanced error handling with type-safe approaches

2. **Model Management**
- Improved model extraction and verification
- Added detailed logging for debugging
- Enhanced file validation processes

#### Implementation Changes

##### Configuration Handling
1. **TTS Configuration**
- Removed shared config approach
- Updated to use model-specific configuration file
- Removed redundant parameter settings that exist in model config

2. **STT Configuration**
- Removed unnecessary modelConfig parameter
- Focused on essential configuration parameters
- Improved validation of model-specific requirements

##### File Structure
1. **New Type Definitions**
- Created `src/types/model-info.ts` for model information
- Created `src/types/config.ts` for configuration interfaces
- Implemented proper type exports and imports

2. **Utility Functions**
- Added `src/utils/model-paths.ts` for path management
- Created `src/utils/config-validator.ts` for configuration validation
- Enhanced error handling and logging utilities

#### Current Project State
- Development Stage: Mid-development
- Core Functionality: Partially implemented
- Configuration System: Restructured for model-specific approach
- Type Safety: Improved with comprehensive interfaces
- Error Handling: Enhanced with detailed logging

#### Next Steps
1. Verify configuration changes resolve initialization errors
2. Implement comprehensive testing for both STT and TTS
3. Enhance error reporting and user feedback
4. Consider adding configuration validation documentation

#### Reference Documentation
- Sherpa-ONNX Node.js documentation
- Model-specific configuration requirements
- VS Code extension development guidelines

#### Notes for Future Development
- Keep configurations model-specific
- Maintain comprehensive type safety
- Ensure proper error handling and logging
- Follow model-specific initialization requirements

</previous_session>

## Future Deployment Considerations

### Model Distribution Strategy
1. **On-Demand Downloads**
- Models should not be bundled with extension
- Implement download prompts when features are first used
- Add progress indicators for downloads
- Provide model selection options (size vs quality)

### Native Files Management
1. **Platform-Specific Binaries**
- Create platform detection system
- Implement selective downloads based on OS
- Add integrity checks for downloaded files

### User Experience
1. **First-Run Experience**
- Add welcome screen with setup options
- Provide quick-start guide
- Show configuration wizard

### Performance Optimization
1. **Resource Management**
- Implement lazy loading for models
- Add cleanup routines for unused models
- Monitor memory usage

### Distribution
1. **Package Size**
- Keep base extension small
- Use CDN for model distribution
- Implement caching strategy

### Error Handling
1. **User-Friendly Messages**
- Convert technical errors to user-friendly messages
- Add troubleshooting guides
- Implement automatic error reporting

### Cross-Platform Compatibility
1. **Platform-Specific Binary Management**
- Implement dynamic binary detection and download
- Support Windows (x64, ARM)
- Support Linux (x64, ARM)
- Support macOS (x64, ARM)
- Handle different file formats (.dll, .so, .dylib)

2. **Installation Process**
- Detect OS and architecture automatically
- Download appropriate binaries silently
- Verify binary integrity
- Set up correct environment variables per platform
- Handle permissions appropriately

3. **Error Handling**
- Provide platform-specific troubleshooting
- Clear error messages for missing dependencies
- Fallback options for different OS versions
- Recovery procedures for failed installations

4. **Testing Requirements**
- Test matrix for all supported platforms
- Validation suite for binary compatibility
- Performance benchmarks per platform
- Installation success verification

These improvements should be implemented before publishing to ensure a smooth user experience.
