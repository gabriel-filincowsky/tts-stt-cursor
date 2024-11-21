import { outputChannel } from './output-channel';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PLATFORM_CONFIGS } from '../types/platform-config';
import * as path from 'path';
import * as fs from 'fs';
import { GPUInfo, GPUCapabilities } from '../types/gpu-types';
import { InitStateManager } from './init-state-manager';
import { VersionManager } from './version-manager';

const execAsync = promisify(exec);

export class GPUManager {
    private static instance: GPUManager;
    private cudaVersion: string | null = null;
    private gpuInfo: GPUInfo | null = null;
    
    private constructor() {}

    static getInstance(): GPUManager {
        if (!this.instance) {
            this.instance = new GPUManager();
        }
        return this.instance;
    }

    async checkGPUAvailability(): Promise<boolean> {
        try {
            const cudaInfo = await this.checkCUDA();
            if (cudaInfo.available && cudaInfo.version) {
                outputChannel.appendLine(`CUDA GPU detected (version ${cudaInfo.version})`);
                this.cudaVersion = cudaInfo.version;
                return true;
            }

            outputChannel.appendLine('No compatible GPU found, falling back to CPU');
            return false;
        } catch (error) {
            outputChannel.appendLine(`GPU check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }

    private async checkCUDA(): Promise<{ available: boolean; version?: string }> {
        const platform = process.platform;
        
        try {
            if (platform === 'win32' || platform === 'linux') {
                const { stdout } = await execAsync('nvidia-smi --query-gpu=driver_version --format=csv,noheader');
                const version = stdout.trim();
                return { available: true, version };
            }
            return { available: false };
        } catch {
            return { available: false };
        }
    }

    async getGPUBinaryPattern(version: string): Promise<string | null> {
        const versionManager = VersionManager.getInstance();
        const state = await versionManager.getVersionState();
        
        if (!await versionManager.validateVersionState(state.currentVersion)) {
            return null;
        }

        const config = PLATFORM_CONFIGS[`${process.platform}-${process.arch}`];
        if (!config?.gpuSupport) return null;

        const hasGPU = await this.checkGPUAvailability();
        if (!hasGPU) {
            return config.gpuSupport.fallbackToCPU ? config.binaryPattern : null;
        }

        return `${config.binaryPattern}-cuda`;
    }

    async initializeGPUContext(): Promise<void> {
        try {
            const platform = process.platform;
            const hasGPU = await this.checkGPUAvailability();
            
            if (!hasGPU) {
                await this.disableGPU();
                return;
            }

            const config = PLATFORM_CONFIGS[`${platform}-${process.arch}`];
            if (!config?.gpuSupport?.environmentVariables) {
                throw new Error('No GPU environment configuration found');
            }

            // Set environment variables
            Object.entries(config.gpuSupport.environmentVariables).forEach(([key, value]) => {
                process.env[key] = value;
            });

            // Initialize GPU context based on platform
            if (platform === 'win32' || platform === 'linux') {
                await this.initializeCUDA();
            } else if (platform === 'darwin') {
                await this.initializeMetal();
            }

            InitStateManager.getInstance().setGPUInitialized(true);
            outputChannel.appendLine('GPU context initialized successfully');
        } catch (error) {
            outputChannel.appendLine(`Failed to initialize GPU context: ${error instanceof Error ? error.message : 'Unknown error'}`);
            await this.disableGPU();
            throw error;
        }
    }

    private async initializeCUDA(): Promise<void> {
        // CUDA-specific initialization
        const cudaVersion = await this.getCUDAVersion();
        if (!cudaVersion) {
            throw new Error('CUDA version not detected');
        }
        
        this.gpuInfo = {
            isAvailable: true,
            deviceId: 0,
            type: 'cuda',
            version: cudaVersion
        };
    }

    private async initializeMetal(): Promise<void> {
        // Metal-specific initialization
        this.gpuInfo = {
            isAvailable: true,
            deviceId: 0,
            type: 'metal'
        };
    }

    async getCUDAVersion(): Promise<string | undefined> {
        const cudaInfo = await this.checkCUDA();
        return cudaInfo.version;
    }

    async verifyGPUBinaryPaths(): Promise<void> {
        outputChannel.appendLine('Verifying GPU binary paths...');
        const platform = process.platform;
        const arch = process.arch;
        const platformKey = `${platform}-${arch}`;
        const config = PLATFORM_CONFIGS[platformKey];

        if (!config?.gpuSupport) {
            outputChannel.appendLine('No GPU support configured for this platform');
            return;
        }

        const nativeDir = path.join(__dirname, '../../native', platformKey);
        for (const file of config.gpuSupport.requiredFiles) {
            const filePath = path.join(nativeDir, file);
            const exists = fs.existsSync(filePath);
            outputChannel.appendLine(`GPU binary ${file}: ${exists ? '✅' : '❌'}`);
            if (!exists) {
                throw new Error(`Missing GPU binary: ${file}`);
            }
        }
    }

    public async disableGPU(): Promise<void> {
        outputChannel.appendLine('Disabling GPU support...');
        // Update environment variables
        process.env.CUDA_VISIBLE_DEVICES = '-1';
        process.env.DISABLE_GPU = '1';
        
        // Update internal state
        this.cudaVersion = null;
        
        outputChannel.appendLine('GPU support disabled');
    }

    async detectGPU(): Promise<boolean> {
        try {
            if (process.platform === 'win32') {
                return await this.detectNvidiaGPU();
            } else if (process.platform === 'darwin') {
                return await this.detectMetalSupport();
            } else {
                return await this.detectLinuxGPU();
            }
        } catch (error) {
            outputChannel.appendLine(`GPU detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }
    
    private async detectNvidiaGPU(): Promise<boolean> {
        try {
            const { stdout } = await execAsync('nvidia-smi');
            return stdout.length > 0;
        } catch {
            return false;
        }
    }

    private async detectMetalSupport(): Promise<boolean> {
        if (process.platform !== 'darwin') return false;
        // Implementation for Metal detection
        return true;
    }

    private async detectLinuxGPU(): Promise<boolean> {
        return this.detectNvidiaGPU();
    }
} 