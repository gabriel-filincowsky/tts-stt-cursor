const path = require('path');
const fs = require('fs');
const os = require('os');

function getPlatformConfig() {
    const platform = os.platform();
    const arch = os.arch();
    
    const configs = {
        'win32-x64': {
            platform: 'win',
            arch: 'x64',
            requiredFiles: ['sherpa-onnx.dll', 'onnxruntime.dll']
        },
        'linux-x64': {
            platform: 'linux',
            arch: 'x64',
            requiredFiles: ['libsherpa-onnx.so', 'libonnxruntime.so']
        },
        'darwin-x64': {
            platform: 'darwin',
            arch: 'x64',
            requiredFiles: ['libsherpa-onnx.dylib', 'libonnxruntime.dylib']
        },
        'darwin-arm64': {
            platform: 'darwin',
            arch: 'arm64',
            requiredFiles: ['libsherpa-onnx.dylib', 'libonnxruntime.dylib']
        }
    };

    const key = `${platform}-${arch}`;
    return configs[key];
}

function setupNative() {
    try {
        const config = getPlatformConfig();
        if (!config) {
            throw new Error(`Unsupported platform: ${os.platform()}-${os.arch()}`);
        }

        const nativeDir = path.join(__dirname, '..', 'native');
        if (!fs.existsSync(nativeDir)) {
            fs.mkdirSync(nativeDir, { recursive: true });
        }

        console.log('Native directory created successfully');
        return true;
    } catch (error) {
        console.error('Error setting up native files:', error);
        return false;
    }
}

// Run setup and handle exit code
if (!setupNative()) {
    process.exit(1);
} 