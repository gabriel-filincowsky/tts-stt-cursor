const path = require('path');
const fs = require('fs');
const https = require('https');
const extract = require('extract-zip');
const tar = require('tar');
const bzip2 = require('unbzip2-stream');

// Platform-specific configuration
const PLATFORM_CONFIGS = {
    'win32-x64': {
        platform: 'win',
        arch: 'x64',
        requiredFiles: ['sherpa-onnx.dll', 'onnxruntime.dll'],
        binaryPattern: 'sherpa-onnx-v{version}-win-x64',
        excludePatterns: ['-cuda', '-gpu']
    },
    'linux-x64': {
        platform: 'linux',
        arch: 'x64',
        requiredFiles: ['libsherpa-onnx.so', 'libonnxruntime.so'],
        binaryPattern: 'sherpa-onnx-v{version}-linux-x64',
        excludePatterns: ['-cuda', '-gpu']
    },
    'darwin-x64': {
        platform: 'darwin',
        arch: 'x64',
        requiredFiles: ['libsherpa-onnx.dylib', 'libonnxruntime.dylib'],
        binaryPattern: 'sherpa-onnx-v{version}-darwin-x64',
        excludePatterns: ['-cuda', '-gpu']
    },
    'darwin-arm64': {
        platform: 'darwin',
        arch: 'arm64',
        requiredFiles: ['libsherpa-onnx.dylib', 'libonnxruntime.dylib'],
        binaryPattern: 'sherpa-onnx-v{version}-darwin-arm64',
        excludePatterns: ['-cuda', '-gpu']
    }
};

async function getLatestCompatibleRelease() {
    const versionManager = require('../out/utils/version-manager').VersionManager.getInstance();
    const gpuManager = require('../out/utils/gpu-manager').GPUManager.getInstance();
    
    const version = versionManager.getExpectedVersion();
    const platform = process.platform;
    const arch = process.arch;
    const config = PLATFORM_CONFIGS[`${platform}-${arch}`];
    
    // Get appropriate binary pattern based on GPU availability
    const binaryPattern = await gpuManager.getGPUBinaryPattern(version) || config.binaryPattern;
    
    const assetPattern = binaryPattern.replace('{version}', version);
    console.log(`Looking for asset matching pattern: ${assetPattern}`);
    
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: '/repos/k2-fsa/sherpa-onnx/releases',
            headers: {
                'User-Agent': 'tts-stt-cursor',
                'Accept': 'application/vnd.github.v3+json'
            }
        };

        https.get(options, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const releases = JSON.parse(data);
                    const packageJson = require('../package.json');
                    const requiredVersion = packageJson.dependencies['sherpa-onnx-node'].replace('^', '');
                    
                    console.log(`Looking for release matching version ${requiredVersion}`);
                    
                    // Find matching release
                    const matchingRelease = releases.find(release => {
                        const version = release.tag_name.replace('v', '');
                        return version === requiredVersion && !release.prerelease;
                    });

                    if (!matchingRelease) {
                        reject(new Error(`No matching release found for version ${requiredVersion}`));
                        return;
                    }

                    // Get platform-specific info
                    const platform = process.platform;
                    const arch = process.arch;
                    const platformKey = `${platform}-${arch}`;
                    const config = PLATFORM_CONFIGS[platformKey];

                    if (!config) {
                        reject(new Error(`Unsupported platform: ${platformKey}`));
                        return;
                    }

                    // Find matching asset
                    const assetPattern = `sherpa-onnx-v${requiredVersion}-${config.platform}-${config.arch}`;
                    console.log(`Looking for asset matching pattern: ${assetPattern}`);

                    const asset = matchingRelease.assets.find(a => {
                        const matchesPattern = a.name.includes(assetPattern);
                        const isExcluded = config.excludePatterns?.some(pattern => 
                            a.name.includes(pattern)
                        ) ?? false;
                        return matchesPattern && !isExcluded;
                    });
                    if (!asset) {
                        reject(new Error(`No matching binary found for ${platformKey}`));
                        return;
                    }

                    resolve({
                        version: requiredVersion,
                        downloadUrl: asset.browser_download_url,
                        fileName: asset.name
                    });
                } catch (err) {
                    reject(new Error(`Failed to parse GitHub API response: ${err.message}`));
                }
            });
        }).on('error', reject);
    });
}

async function downloadAndExtract(url, targetDir, isGPU = false) {
    const tempFile = path.join(targetDir, '_temp_download');
    
    await new Promise((resolve, reject) => {
        https.get(url, (response) => {
            const fileStream = fs.createWriteStream(tempFile);
            
            if (url.endsWith('.tar.bz2')) {
                response.pipe(bzip2())
                    .pipe(tar.extract({ cwd: targetDir }))
                    .on('finish', resolve)
                    .on('error', reject);
            } else if (url.endsWith('.zip')) {
                response.pipe(fileStream)
                    .on('finish', async () => {
                        try {
                            await extract(tempFile, { dir: targetDir });
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', reject);
            } else {
                reject(new Error(`Unsupported archive format: ${url}`));
            }
        }).on('error', reject);
    });

    // Cleanup temp file
    if (fs.existsSync(tempFile)) {
        await fs.promises.unlink(tempFile);
    }
}

async function main() {
    try {
        console.log('Starting native files setup...');
        const versionManager = require('../out/utils/version-manager').VersionManager.getInstance();
        await versionManager.ensureInitialSetup();
        console.log('Setup completed successfully');
    } catch (error) {
        console.error('Setup failed:', error);
        process.exit(1);
    }
}

main(); 