import { outputChannel } from './output-channel';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PLATFORM_CONFIGS } from '../types/platform-config';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

export class GPUManager {
    private static instance: GPUManager;
    private cudaVersion: string | null = null;
    
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
        const config = PLATFORM_CONFIGS[`${process.platform}-${process.arch}`];
        if (!config?.gpuSupport) return null;

        const hasGPU = await this.checkGPUAvailability();
        if (!hasGPU && config.gpuSupport.fallbackToCPU) {
            return config.binaryPattern;
        }

        return `${config.binaryPattern}-cuda`;
    }

    async initializeGPUContext(): Promise<void> {
        // Implementation needed
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
} 