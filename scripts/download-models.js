const https = require('https');
const fs = require('fs');
const path = require('path');

const models = {
    'stt': {
        url: 'https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-en-2023-06-26/resolve/main/sherpa-onnx-streaming-zipformer-en-2023-06-26.tar.bz2',
        filename: 'sherpa-onnx-streaming-zipformer-en-2023-06-26.tar.bz2'
    },
    'tts': {
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/low/en_US-amy-low.onnx.json',
        filename: 'vits-piper-en_US-amy-low.tar.bz2'
    }
};

async function downloadModel(type, url, filename) {
    const modelDir = path.join(__dirname, '..', 'models', type);
    const filePath = path.join(modelDir, filename);

    if (fs.existsSync(filePath)) {
        console.log(`Model ${filename} already exists.`);
        return;
    }

    console.log(`Downloading ${type} model...`);
    
    return new Promise((resolve, reject) => {
        https.get(url, response => {
            const file = fs.createWriteStream(filePath);
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`Downloaded ${filename}`);
                resolve();
            });
        }).on('error', err => {
            fs.unlink(filePath);
            reject(err);
        });
    });
}

async function downloadAllModels() {
    for (const [type, info] of Object.entries(models)) {
        await downloadModel(type, info.url, info.filename);
    }
}

downloadAllModels().catch(console.error); 