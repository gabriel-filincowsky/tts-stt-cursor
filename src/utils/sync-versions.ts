import { VersionManager } from './version-manager';
import * as path from 'path';
import { outputChannel } from './output-channel';
import * as fs from 'fs/promises';

async function updateEnvironment(): Promise<void> {
    const platform = process.platform;
    const arch = process.arch;
    const platformKey = `${platform}-${arch}`;
    const nativeDir = path.join(__dirname, '../../native', platformKey);
    
    outputChannel.appendLine(`Updating environment variables for ${platformKey}`);
    outputChannel.appendLine(`Native directory: ${nativeDir}`);

    switch (platform) {
        case 'win32':
            process.env.PATH = `${nativeDir};${process.env.PATH || ''}`;
            break;
        case 'darwin':
            process.env.DYLD_LIBRARY_PATH = `${nativeDir}:${process.env.DYLD_LIBRARY_PATH || ''}`;
            break;
        case 'linux':
            process.env.LD_LIBRARY_PATH = `${nativeDir}:${process.env.LD_LIBRARY_PATH || ''}`;
            break;
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }

    outputChannel.appendLine('Environment variables updated successfully');
}

async function updatePackageVersion(targetVersion: string): Promise<void> {
    try {
        const packageJsonPath = path.join(__dirname, '../../package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
        
        // Update the sherpa-onnx-node version
        if (packageJson.dependencies['sherpa-onnx-node'] !== targetVersion) {
            packageJson.dependencies['sherpa-onnx-node'] = targetVersion;
            await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
            outputChannel.appendLine(`Updated package.json sherpa-onnx-node version to ${targetVersion}`);
        }
    } catch (error) {
        outputChannel.appendLine(`Failed to update package version: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
}

export async function synchronizeVersions(): Promise<void> {
    const versionManager = VersionManager.getInstance();
    
    try {
        const targetVersion = await versionManager.determineTargetVersion();
        const state = await versionManager.getVersionState();

        // Check if we need to synchronize
        if (await versionManager.validateVersionState(targetVersion)) {
            outputChannel.appendLine('Version already synchronized');
            return;
        }
        
        // Ensure clean state before synchronization
        await cleanupOldInstallation();
        
        // Platform-specific installation
        const platform = process.platform;
        const arch = process.arch;
        
        if (!await versionManager.ensureBinariesInstalled(platform, arch)) {
            throw new Error('Binary installation failed during synchronization');
        }
        
        await versionManager.setActualVersion(targetVersion);
        outputChannel.appendLine('Version synchronization completed successfully');
    } catch (error) {
        outputChannel.appendLine(`Version synchronization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
}

async function cleanupOldInstallation(): Promise<void> {
    try {
        const platform = process.platform;
        const arch = process.arch;
        const nativeDir = path.join(__dirname, '../../native', `${platform}-${arch}`);
        
        outputChannel.appendLine(`Cleaning up old installation in ${nativeDir}`);
        
        // Check if directory exists
        try {
            await fs.access(nativeDir);
        } catch {
            outputChannel.appendLine('No old installation found');
            return;
        }

        // Remove old files
        const files = await fs.readdir(nativeDir);
        for (const file of files) {
            const filePath = path.join(nativeDir, file);
            try {
                await fs.unlink(filePath);
                outputChannel.appendLine(`Removed: ${file}`);
            } catch (error) {
                outputChannel.appendLine(`Failed to remove ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        // Try to remove directory
        try {
            await fs.rmdir(nativeDir);
            outputChannel.appendLine('Removed old installation directory');
        } catch (error) {
            outputChannel.appendLine(`Warning: Could not remove directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    } catch (error) {
        outputChannel.appendLine(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
} 