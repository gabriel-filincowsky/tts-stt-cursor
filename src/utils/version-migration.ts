import { VersionStateManager } from './version-state';
import { outputChannel } from './output-channel';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function migrateVersionState(): Promise<void> {
    const versionState = new VersionStateManager();
    
    try {
        // Check for old version file
        const oldVersionPath = path.join(__dirname, '../../.version');
        try {
            const oldVersion = await fs.readFile(oldVersionPath, 'utf8');
            if (oldVersion) {
                await versionState.setState({
                    currentVersion: oldVersion.trim(),
                    targetVersion: oldVersion.trim(),
                    lastCheck: new Date().toISOString()
                });
                await fs.unlink(oldVersionPath);
                outputChannel.appendLine('Migrated from old version file');
            }
        } catch {
            // Old version file doesn't exist, that's fine
        }

        // Load current state
        await versionState.loadState();
        
        // Cleanup old installations
        await versionState.cleanupOldInstallations();
        
        outputChannel.appendLine('Version state migration completed');
    } catch (error) {
        outputChannel.appendLine(`Version migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
} 