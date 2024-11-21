const fs = require('fs');
const path = require('path');

// Test configurations
const configs = {
    stt: {
        transducer: {
            encoder: "test/fixtures/models/stt/encoder.onnx",
            decoder: "test/fixtures/models/stt/decoder.onnx",
            joiner: "test/fixtures/models/stt/joiner.onnx"
        },
        tokens: "test/fixtures/models/stt/tokens.txt",
        featConfig: {
            sampleRate: 16000,
            featureDim: 80
        },
        decodingConfig: {
            method: "greedy_search"
        },
        enableEndpoint: true,
        rule1MinTrailingSilence: 145
    },
    tts: {
        model: "test/fixtures/models/tts/model.onnx",
        modelConfig: "test/fixtures/models/tts/config.json",
        tokens: "test/fixtures/models/tts/tokens.txt",
        numThreads: 1,
        debug: true
    }
};

// Create test fixtures
Object.entries(configs).forEach(([type, config]) => {
    const configPath = path.join(__dirname, '..', 'test', 'fixtures', 'configs', `${type}-config.json`);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Created ${type} test config`);
});

console.log('Test fixtures setup complete'); 