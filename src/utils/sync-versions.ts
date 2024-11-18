import { VersionManager } from './version-manager';
import * as path from 'path';
import { outputChannel } from './output-channel';

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

export async function synchronizeVersions(): Promise<void> {
    const versionManager = VersionManager.getInstance();
    const platform = process.platform;
    const arch = process.arch;
    
    outputChannel.appendLine(`Starting version synchronization for ${platform}-${arch}`);
    
    try {
        // Step 1: Validate version compatibility
        const isValid = await versionManager.validateVersion();
        if (!isValid) {
            throw new Error('Version validation failed before synchronization');
        }

        // Step 2: Ensure binaries are installed
        await versionManager.ensureBinariesInstalled(platform, arch);
        
        // Step 3: Update environment variables
        await updateEnvironment();
        
        // Step 4: Validate final state and update version lock
        const finalValidation = await versionManager.validateVersion();
        if (!finalValidation) {
            throw new Error('Version validation failed after synchronization');
        }
        
        outputChannel.appendLine('Version synchronization completed successfully');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        outputChannel.appendLine(`Version synchronization failed: ${errorMessage}`);
        throw error;
    }
} 