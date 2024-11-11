const fs = require('fs');
const path = require('path');

const modelDirs = ['stt', 'tts'];
const baseDir = path.join(__dirname, '..', 'models');

// Ensure base models directory exists
if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir);
}

// Create model type directories and add .gitkeep
modelDirs.forEach(dir => {
    const fullPath = path.join(baseDir, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath);
        fs.writeFileSync(path.join(fullPath, '.gitkeep'), '');
    }
});

// Copy model configs if they don't exist
const configs = {
    'stt/model_config.json': {
        "type": "stt",
        "language": "en_US",
        "model_version": "epoch-99",
        "parameters": {
            "encoder": "encoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx",
            "decoder": "decoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx",
            "joiner": "joiner-epoch-99-avg-1-chunk-16-left-128.int8.onnx",
            "tokens": "tokens.txt"
        },
        "feat_config": {
            "sample_rate": 16000,
            "feature_dim": 80
        },
        "decoding_config": {
            "method": "greedy_search"
        },
        "enable_endpoint": true,
        "rule1_min_trailing_silence": 1.0,
        "decoder_config": {},
        "hotwords_file": "",
        "hotwords_score": 1.0
    },
    'tts/model_config.json': {
        "type": "tts",
        "language": {
            "code": "en_US",
            "family": "en",
            "region": "US",
            "name_native": "English",
            "name_english": "English",
            "country_english": "United States"
        },
        "model_version": "vits-piper-en_US-amy-low",
        "parameters": {
            "model": "en_US-amy-low.onnx",
            "model_config": "en_US-amy-low.onnx.json",
            "tokens": "tokens.txt"
        },
        "audio": {
            "sample_rate": 16000,
            "quality": "low"
        },
        "inference": {
            "noise_scale": 0.667,
            "length_scale": 1.0,
            "noise_w": 0.8
        },
        "num_threads": 1,
        "debug": true,
        "dataset": "amy",
        "piper_version": "0.2.0"
    }
};

Object.entries(configs).forEach(([file, content]) => {
    const configPath = path.join(baseDir, file);
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify(content, null, 2));
    }
});

console.log('Model directories and configurations set up successfully.'); 