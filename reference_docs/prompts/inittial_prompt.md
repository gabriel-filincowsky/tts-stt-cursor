# Project Context: TTS-STT for Cursor Extension Development

Please review my system prompt and the shared documentation.

Confirm that you understand the context and then acknowledge it.

## Project Overview
We are developing a Visual Studio Code extension named "TTS-STT for Cursor," which integrates speech-to-text (STT) and text-to-speech (TTS) functionalities using the Sherpa-ONNX framework. This extension is being developed in TypeScript and utilizes platform-specific Sherpa-ONNX binaries for native performance. 

The implementation leverages:
- Platform-specific compiled binaries for optimal performance
- GPU acceleration support where available (CUDA for Windows/Linux, Metal for macOS)
- Multi-threading capabilities for real-time processing
- TypeScript for type-safe integration and extension development

The extension manages binary distribution and version synchronization to ensure compatibility across different platforms (Windows, Linux, macOS) and architectures (x64, ARM64). This approach provides:
- Native performance through platform-optimized binaries
- Hardware acceleration support
- Efficient real-time speech processing
- Cross-platform compatibility
- Seamless integration within the Cursor IDE environment

### Key Components
- Binary Management System: Handles platform-specific binary distribution
- Version Control: Ensures compatibility between components
- GPU Support: Provides hardware acceleration where available
- Error Handling: Manages graceful fallbacks and user feedback
