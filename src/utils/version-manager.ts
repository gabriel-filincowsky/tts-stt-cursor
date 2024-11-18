import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { PlatformConfig, PLATFORM_CONFIGS } from '../types/platform-config';
import { outputChannel } from './output-channel';
import { GPUManager } from './gpu-manager';

interface Release {
    tag_name: string;
    prerelease: boolean;
    assets: Array<{ name: string; browser_download_url: string }>;
}

interface VersionInfo {
    sherpaNode: string;
    binaries: string;
    lastVerified: string;
    platform?: {
        [key: string]: {
            lastCheck: string;
            status: 'verified' | 'unverified';
        };
    };
}

export class VersionManager {
    private static instance: VersionManager;
    private versionInfo: VersionInfo;
    private readonly versionFilePath: string;
    private cachedReleaseInfo: Release[] | null = null;
    private packageVersion: string;

    private constructor() {
        this.versionFilePath = path.join(__dirname, '../../sherpa-version.json');
        this.versionInfo = this.loadVersionInfo();
        this.packageVersion = this.versionInfo.sherpaNode;
    }

    private loadVersionInfo(): VersionInfo {
        try {
            const data = fs.readFileSync(this.versionFilePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            outputChannel.appendLine(`Failed to load version info: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return {
                sherpaNode: require('../../package.json').dependencies['sherpa-onnx-node'].replace('^', ''),
                binaries: '0.0.0',
                lastVerified: new Date().toISOString()
            };
        }
    }

    private async saveVersionInfo(): Promise<void> {
        try {
            fs.writeFileSync(this.versionFilePath, JSON.stringify(this.versionInfo, null, 4));
        } catch (error) {
            outputChannel.appendLine(`Failed to save version info: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    static getInstance(): VersionManager {
        if (!this.instance) {
            this.instance = new VersionManager();
        }
        return this.instance;
    }

    private async fetchReleases(): Promise<Release[]> {
        if (this.cachedReleaseInfo !== null) {
            return this.cachedReleaseInfo;
        }

        outputChannel.appendLine('Fetching Sherpa-ONNX releases...');
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
                if (response.statusCode === 301 || response.statusCode === 302) {
                    reject(new Error(`Redirect received: ${response.headers.location}`));
                    return;
                }

                let data = '';
                response.on('data', (chunk) => data += chunk);
                response.on('end', () => {
                    try {
                        if (response.statusCode !== 200) {
                            throw new Error(`GitHub API returned status ${response.statusCode}: ${data}`);
                        }
                        const releases = JSON.parse(data) as Release[];
                        this.cachedReleaseInfo = releases;
                        outputChannel.appendLine(`Found ${releases.length} releases`);
                        resolve(releases);
                    } catch (err) {
                        reject(err);
                    }
                });
            }).on('error', reject);
        });
    }

    private async findCompatibleRelease(releases: Release[], platform: string, arch: string): Promise<{
        version: string;
        url: string;
        files: string[];
    }> {
        const platformKey = `${platform}-${arch}` as keyof typeof PLATFORM_CONFIGS;
        const config = PLATFORM_CONFIGS[platformKey];
        const gpuManager = GPUManager.getInstance();

        if (!config) {
            throw new Error(`Unsupported platform: ${platformKey}`);
        }

        const hasGPU = await gpuManager.checkGPUAvailability();
        const requiredFiles = hasGPU && config.gpuSupport 
            ? [...config.requiredFiles, ...config.gpuSupport.requiredFiles]
            : config.requiredFiles;

        const compatibleRelease = releases.find(release => {
            const version = release.tag_name.replace('v', '');
            return version === this.packageVersion && !release.prerelease;
        });

        if (!compatibleRelease) {
            throw new Error(`No compatible release found for version ${this.packageVersion}`);
        }

        const assetPattern = config.binaryPattern.replace('{version}', this.packageVersion);

        const asset = compatibleRelease.assets.find(a => {
            const matchesPattern = a.name.includes(assetPattern);
            const isGPUVariant = a.name.includes('-cuda') || a.name.includes('-gpu');
            return matchesPattern && (hasGPU === isGPUVariant);
        });

        if (!asset) {
            throw new Error(`Binary not found for platform ${platform}-${arch}`);
        }

        return {
            version: this.packageVersion,
            url: asset.browser_download_url,
            files: requiredFiles
        };
    }

    async getCompatibleRelease(platform: string, arch: string) {
        const releases = await this.fetchReleases();
        return this.findCompatibleRelease(releases, platform, arch);
    }

    async validateVersion(): Promise<boolean> {
        try {
            const platform = process.platform;
            const arch = process.arch;
            const platformKey = `${platform}-${arch}` as keyof typeof PLATFORM_CONFIGS;
            
            // Check if we have valid version info
            if (!this.versionInfo.platform?.[platformKey] || 
                this.versionInfo.platform[platformKey].status !== 'verified') {
                return false;
            }
            
            // Verify binary files exist
            const config = PLATFORM_CONFIGS[platformKey];
            const targetDir = path.join(__dirname, '../../native', platformKey);
            
            const allFilesExist = config.requiredFiles.every(file => 
                fs.existsSync(path.join(targetDir, file))
            );
            
            if (!allFilesExist) {
                return false;
            }
            
            // Verify version matches
            return this.versionInfo.binaries === this.packageVersion;
            
        } catch (error) {
            outputChannel.appendLine(`Version validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }

    public async validateBinaryInstallation(release: Release): Promise<boolean> {
        try {
            const compatibleRelease = await this.findCompatibleRelease(
                [release],
                process.platform,
                process.arch
            );
            
            if (!compatibleRelease) {
                return false;
            }

            // ... rest of validation logic ...
            return true;
        } catch (error) {
            outputChannel.appendLine(`Binary validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }

    async ensureBinariesInstalled(platform: string, arch: string): Promise<void> {
        outputChannel.appendLine(`Ensuring binaries for ${platform}-${arch}`);
        
        try {
            const releases = await this.fetchReleases();
            const compatibleRelease = await this.findCompatibleRelease(releases, platform, arch);
            
            if (!compatibleRelease) {
                throw new Error('No compatible release found');
            }

            // Check if binaries already exist and are valid
            const platformKey = `${platform}-${arch}` as keyof typeof PLATFORM_CONFIGS;
            const config = PLATFORM_CONFIGS[platformKey];
            const targetDir = path.join(__dirname, '../../native', platformKey);
            
            const needsInstallation = !fs.existsSync(targetDir) || 
                config.requiredFiles.some(file => !fs.existsSync(path.join(targetDir, file)));
            
            if (needsInstallation) {
                await this.downloadAndExtractBinaries(compatibleRelease, platform, arch);
            }
            
            // Update version info with platform status
            this.versionInfo.platform = this.versionInfo.platform || {};
            this.versionInfo.platform[platformKey] = {
                lastCheck: new Date().toISOString(),
                status: 'verified'
            };
            await this.saveVersionInfo();
            
        } catch (error) {
            outputChannel.appendLine(`Failed to ensure binaries: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    private async downloadAndExtractBinaries(
        release: { version: string; url: string; files: string[] },
        platform: string,
        arch: string
    ): Promise<void> {
        const platformKey = `${platform}-${arch}` as keyof typeof PLATFORM_CONFIGS;
        const config = PLATFORM_CONFIGS[platformKey];
        const targetDir = path.join(__dirname, '../../native', platformKey);
        const tempFile = path.join(targetDir, 'temp.download');

        outputChannel.appendLine(`Downloading binaries from: ${release.url}`);
        outputChannel.appendLine(`Target directory: ${targetDir}`);

        // Ensure target directory exists
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        try {
            // Download file
            await new Promise<void>((resolve, reject) => {
                const file = fs.createWriteStream(tempFile);
                https.get(release.url, (response) => {
                    if (response.statusCode === 302 || response.statusCode === 301) {
                        https.get(response.headers.location!, (redirectResponse) => {
                            redirectResponse.pipe(file);
                        });
                        return;
                    }
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                }).on('error', reject);
            });

            outputChannel.appendLine('Download completed, starting extraction...');

            // Extract based on file type
            if (release.url.endsWith('.zip')) {
                const extract = require('extract-zip');
                await extract(tempFile, { dir: targetDir });
            } else if (release.url.endsWith('.tar.gz')) {
                const tar = require('tar');
                await tar.x({
                    file: tempFile,
                    cwd: targetDir,
                    strip: 1
                });
            }

            // Clean up temp file
            fs.unlinkSync(tempFile);

            // Verify extraction
            const missingFiles = release.files.filter(file => 
                !fs.existsSync(path.join(targetDir, file))
            );

            if (missingFiles.length > 0) {
                throw new Error(`Missing files after extraction: ${missingFiles.join(', ')}`);
            }

            outputChannel.appendLine('Binary installation completed successfully');
        } catch (error) {
            // Clean up on failure
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
            throw error;
        }
    }

    private async validateVersionCompatibility(release: Release): Promise<boolean> {
        const releaseVersion = release.tag_name.replace('v', '');
        
        // Check against version.json
        if (releaseVersion !== this.versionInfo.sherpaNode) {
            outputChannel.appendLine(`Version mismatch: Found ${releaseVersion}, required ${this.versionInfo.sherpaNode}`);
            return false;
        }

        // Check binary compatibility
        const binaryAssets = release.assets.filter(a => 
            a.name.includes(releaseVersion) && 
            (a.name.endsWith('.dll') || a.name.endsWith('.so') || a.name.endsWith('.dylib'))
        );

        if (binaryAssets.length === 0) {
            outputChannel.appendLine(`No compatible binaries found for version ${releaseVersion}`);
            return false;
        }

        // Update version info
        this.versionInfo.binaries = releaseVersion;
        this.versionInfo.lastVerified = new Date().toISOString();
        await this.saveVersionInfo();

        return true;
    }

    public getExpectedVersion(): string {
        return this.versionInfo.sherpaNode;
    }

    public getActualVersion(): string {
        return this.versionInfo.binaries;
    }

    private async validateGPUBinaryVersion(): Promise<boolean> {
        try {
            const gpuManager = GPUManager.getInstance();
            const hasGPU = await gpuManager.checkGPUAvailability();
            
            if (!hasGPU) {
                return true; // Skip validation for CPU-only setup
            }

            const platform = process.platform;
            const arch = process.arch;
            const platformKey = `${platform}-${arch}`;
            const config = PLATFORM_CONFIGS[platformKey];

            if (!config?.gpuSupport) {
                return true;
            }

            // Validate GPU binary files
            const nativeDir = path.join(__dirname, '../../native', platformKey);
            for (const file of config.gpuSupport.requiredFiles) {
                const filePath = path.join(nativeDir, file);
                if (!fs.existsSync(filePath)) {
                    outputChannel.appendLine(`Missing GPU binary: ${file}`);
                    return false;
                }
            }

            return true;
        } catch (error) {
            outputChannel.appendLine(`GPU binary validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }

    public async ensureInitialSetup(): Promise<void> {
        outputChannel.appendLine('Starting initial setup...');
        
        try {
            const platform = process.platform;
            const arch = process.arch;
            
            // Check if binaries are already installed
            const isValid = await this.validateVersion();
            if (isValid) {
                outputChannel.appendLine('Existing installation is valid');
                return;
            }

            // Download and install binaries
            await this.ensureBinariesInstalled(platform, arch);
            
            // Validate installation
            const finalCheck = await this.validateVersion();
            if (!finalCheck) {
                throw new Error('Installation validation failed');
            }

            outputChannel.appendLine('Initial setup completed successfully');
        } catch (error) {
            outputChannel.appendLine(`Initial setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
} 