import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as https from 'https';
import { PlatformConfig, PLATFORM_CONFIGS } from '../types/platform-config';
import { outputChannel } from './output-channel';
import { GPUManager } from './gpu-manager';
import { APIService } from '../services/api-service';
import { SherpaRelease, SherpaAsset } from '../types/api-types';
import { meetsMinimumVersion } from './version-utils';
import { promisify } from 'util';
import * as os from 'os';
import { VersionStateManager } from './version-state';
import type { VersionState } from './version-state';

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
    private versionState: VersionStateManager;
    
    private constructor() {
        this.versionState = new VersionStateManager();
    }

    public static getInstance(): VersionManager {
        if (!VersionManager.instance) {
            VersionManager.instance = new VersionManager();
        }
        return VersionManager.instance;
    }

    async determineTargetVersion(): Promise<string> {
        try {
            return this.versionState.getState().targetVersion || '1.10.30';
        } catch (error) {
            outputChannel.appendLine(`Failed to determine target version: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return '1.10.30';
        }
    }

    getActualVersion(): string {
        return this.versionState.getState().currentVersion;
    }

    async setActualVersion(version: string): Promise<void> {
        this.versionState.setState({
            currentVersion: version,
            targetVersion: version,
            lastCheck: new Date().toISOString(),
            installedBinaries: []
        });
    }

    isVersionValidated(): boolean {
        return this.versionState.getState().currentVersion !== '0.0.0';
    }

    getBinaryPath(): string {
        const binaries = this.versionState.getState().installedBinaries[0]?.binaries;
        return binaries ? binaries[0] : '';
    }

    async downloadBinaries(platform: string, arch: string, hasGPU: boolean): Promise<boolean> {
        try {
            const targetVersion = await this.determineTargetVersion();
            const apiService = APIService.getInstance({
                endpoints: {
                    releases: 'https://api.github.com/repos/k2-fsa/sherpa-onnx/releases',
                    assets: 'https://api.github.com/repos/k2-fsa/sherpa-onnx/releases/{version}/assets',
                    models: 'https://api.github.com/repos/k2-fsa/sherpa-onnx/contents/models'
                },
                cache: {
                    duration: 3600000,
                    path: path.join(__dirname, '../../.cache')
                }
            });

            const assets = await apiService.getCompatibleAssets(platform, arch);
            if (assets.length === 0) {
                throw new Error(`No compatible binaries found for ${platform}-${arch}`);
            }

            // Select appropriate asset based on GPU availability
            const asset = assets.find(a => hasGPU ? a.platform.type === 'gpu' : a.platform.type === 'cpu');
            if (!asset) {
                throw new Error('No suitable binary found');
            }

            // Download and extract
            // Implementation details...
            return true;
        } catch (error) {
            outputChannel.appendLine(`Failed to download binaries: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }

    async verifyInstallation(): Promise<boolean> {
        try {
            const platform = process.platform;
            const arch = process.arch;
            const config = PLATFORM_CONFIGS[`${platform}-${arch}`];
            
            if (!config) {
                throw new Error(`No configuration found for ${platform}-${arch}`);
            }

            const nativeDir = path.join(__dirname, '../../native', `${platform}-${arch}`);
            
            // Verify required files
            for (const file of config.requiredFiles) {
                const filePath = path.join(nativeDir, file);
                if (!fs.existsSync(filePath)) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            outputChannel.appendLine(`Installation verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }

    async ensureInitialSetup(): Promise<void> {
        // Implementation of initial setup
    }

    async validateVersion(targetVersion: string): Promise<boolean> {
        try {
            return await this.versionState.validateVersion(targetVersion);
        } catch (error) {
            outputChannel.appendLine(`Version validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }

    async ensureBinariesInstalled(platform: string, arch: string): Promise<boolean> {
        try {
            const targetVersion = await this.determineTargetVersion();
            const state = this.versionState.getState();

            // Check if compatible version is already installed
            if (await this.versionState.validateVersion(targetVersion)) {
                const platformKey = `${platform}-${arch}`;
                const hasValidBinaries = state.installedBinaries.some(
                    binary => binary.platform === platform && 
                             binary.arch === arch &&
                             binary.version === targetVersion
                );
                if (hasValidBinaries) {
                    return true;
                }
            }

            // Proceed with installation
            return await this.installNewVersion(targetVersion, platform, arch);
        } catch (error) {
            outputChannel.appendLine(`Binary installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }

    async installNewVersion(targetVersion: string, platform: string, arch: string): Promise<boolean> {
        try {
            const gpuManager = GPUManager.getInstance();
            const hasGPU = await gpuManager.detectGPU();
            
            const downloadResult = await this.downloadBinaries(platform, arch, hasGPU);
            if (!downloadResult) {
                throw new Error('Binary download failed');
            }
            
            return await this.verifyInstallation();
        } catch (error) {
            throw new Error(`Failed to install binaries: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Public methods to access version state functionality
    public async getVersionState(): Promise<Readonly<VersionState>> {
        return this.versionState.getState();
    }

    public async validateVersionState(targetVersion: string): Promise<boolean> {
        return this.versionState.validateVersion(targetVersion);
    }

    public async updateVersionState(newState: Partial<VersionState>): Promise<void> {
        await this.versionState.setState(newState);
    }
} 