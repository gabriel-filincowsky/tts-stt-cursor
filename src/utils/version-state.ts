import * as semver from 'semver';
import * as fs from 'fs/promises';
import * as path from 'path';
import { outputChannel } from './output-channel';

export interface VersionState {
    targetVersion: string;
    currentVersion: string;
    lastCheck: string;
    installedBinaries: Array<{
        version: string;
        platform: string;
        arch: string;
        type: 'cpu' | 'gpu';
        timestamp: string;
        binaries: string[];
    }>;
}

export class VersionStateManager {
    private static readonly STATE_FILE = 'sherpa-version.json';
    private state: VersionState;
    private readonly statePath: string;

    constructor() {
        this.statePath = path.join(__dirname, '../../', VersionStateManager.STATE_FILE);
        this.state = this.getDefaultState();
    }

    private getDefaultState(): VersionState {
        return {
            targetVersion: '1.10.30',
            currentVersion: '1.10.30',
            lastCheck: new Date().toISOString(),
            installedBinaries: []
        };
    }

    private getStatePath(): string {
        return this.statePath;
    }

    private validateStateIntegrity(): boolean {
        if (!this.state) return false;
        
        // Check version format
        if (!semver.valid(this.state.currentVersion)) return false;
        if (!semver.valid(this.state.targetVersion)) return false;
        
        // Validate binary records
        return this.state.installedBinaries.every(binary => 
            binary.version && 
            binary.platform && 
            binary.arch && 
            Array.isArray(binary.binaries) &&
            binary.binaries.length > 0
        );
    }

    async loadState(): Promise<void> {
        try {
            const content = await fs.readFile(this.getStatePath(), 'utf8');
            const loadedState = JSON.parse(content);
            
            this.state = loadedState;
            if (!this.validateStateIntegrity()) {
                outputChannel.appendLine('Invalid state detected, using default');
                this.state = this.getDefaultState();
            }
        } catch (error) {
            outputChannel.appendLine('No existing state found, using default');
            this.state = this.getDefaultState();
        }
    }

    async saveState(): Promise<void> {
        try {
            await fs.writeFile(
                this.getStatePath(),
                JSON.stringify(this.state, null, 2)
            );
            outputChannel.appendLine('Version state saved successfully');
        } catch (error) {
            outputChannel.appendLine(`Failed to save state: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    getState(): Readonly<VersionState> {
        return { ...this.state };
    }

    async setState(newState: Partial<VersionState>): Promise<void> {
        this.state = {
            ...this.state,
            ...newState
        };
        await this.saveState();
    }

    async validateVersion(targetVersion: string): Promise<boolean> {
        if (!this.state.currentVersion || this.state.currentVersion === '0.0.0') {
            return false;
        }
        
        // Allow minor version updates (1.10.30 -> 1.10.31)
        const isCompatible = semver.satisfies(this.state.currentVersion, `~${targetVersion}`);
        outputChannel.appendLine(`Version compatibility check: ${this.state.currentVersion} vs ${targetVersion} -> ${isCompatible ? 'compatible' : 'incompatible'}`);
        return isCompatible;
    }

    async addInstalledBinary(binary: {
        version: string;
        platform: string;
        arch: string;
        type: 'cpu' | 'gpu';
        binaries: string[];
    }): Promise<void> {
        this.state.installedBinaries = [
            {
                ...binary,
                timestamp: new Date().toISOString()
            },
            ...this.state.installedBinaries
        ].slice(0, 5); // Keep only last 5 installations
        
        await this.saveState();
    }

    async cleanupOldInstallations(): Promise<void> {
        const currentPlatform = `${process.platform}-${process.arch}`;
        this.state.installedBinaries = this.state.installedBinaries.filter(
            binary => `${binary.platform}-${binary.arch}` === currentPlatform
        );
        await this.saveState();
    }

    async reset(): Promise<void> {
        this.state = this.getDefaultState();
        await this.saveState();
    }
} 