# Models for TTS-STT Cursor Extension

## Directory Structure

```text
models/
├── stt/
│   ├── model_config.json
│   └── sherpa-onnx-streaming-zipformer-en-2023-06-26/
│       ├── encoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx
│       ├── decoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx
│       ├── joiner-epoch-99-avg-1-chunk-16-left-128.int8.onnx
│       └── tokens.txt
└── tts/
    ├── model_config.json
    └── vits-piper-en_US-amy-low/
        ├── en_US-amy-low.onnx
        ├── en_US-amy-low.onnx.json
        └── tokens.txt
```

## Required Models

### Speech-to-Text (STT)
Download the STT model from: [sherpa-onnx-streaming-zipformer-en-2023-06-26.tar.bz2](https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-en-2023-06-26/resolve/main/sherpa-onnx-streaming-zipformer-en-2023-06-26.tar.bz2)
Place it in the `models/stt/` directory.

### Text-to-Speech (TTS)
Download the TTS model from: [vits-piper-en_US-amy-low.tar.bz2](https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/low/en_US-amy-low.onnx.json)
Place it in the `models/tts/` directory.

## Installation Steps

1. Create the required directories:

```bash
mkdir -p models/stt models/tts
```

2. Download the model files:

```bash
# Download STT model
curl -L "https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-en-2023-06-26/resolve/main/sherpa-onnx-streaming-zipformer-en-2023-06-26.tar.bz2" -o "models/stt/sherpa-onnx-streaming-zipformer-en-2023-06-26.tar.bz2"

# Download TTS model
curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/low/en_US-amy-low.onnx.json" -o "models/tts/vits-piper-en_US-amy-low.tar.bz2"
```

3. The extension will automatically extract and set up the models on first run.

## Model Configurations

The `model_config.json` files in both `stt/` and `tts/` directories contain the necessary configurations for the models. These files are included in the repository and should not be modified unless you know what you're doing.

## Development Notes

During development:
1. Place the downloaded model files in their respective directories
2. The extension will handle extraction and verification
3. Check the "TTS-STT Logs" output channel for detailed information about model loading and verification

## Troubleshooting

If you encounter issues:
1. Verify that all required files are present in the correct directories
2. Check the model configurations match the expected format
3. Ensure the model files are properly extracted
4. Review the extension logs for specific error messages