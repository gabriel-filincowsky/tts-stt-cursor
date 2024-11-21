import * as assert from 'assert';
import { VersionManager } from '../../src/utils/version-manager';
import { VersionStateManager } from '../../src/utils/version-state';
import { migrateVersionState } from '../../src/utils/migrate-version-state';
import * as sinon from 'sinon';
import * as semver from 'semver';

describe('Version Management Tests', () => {
    let manager: VersionManager;
    let stateManager: VersionStateManager;
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        manager = VersionManager.getInstance();
        stateManager = new VersionStateManager();
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('Version Validation', () => {
        it('should validate version correctly', async () => {
            const targetVersion = await manager.determineTargetVersion();
            const isValid = await manager.validateVersion(targetVersion);
            assert.strictEqual(typeof isValid, 'boolean');
        });

        it('should handle compatible minor versions', async () => {
            const baseVersion = '1.10.30';
            const compatibleVersion = '1.10.31';
            
            await stateManager.setState({
                currentVersion: compatibleVersion,
                targetVersion: baseVersion,
                lastCheck: new Date().toISOString(),
                installedBinaries: []
            });

            const isValid = await stateManager.validateVersion(baseVersion);
            assert.strictEqual(isValid, true);
        });
    });

    describe('Binary Management', () => {
        it('should handle binary installation', async () => {
            const result = await manager.ensureBinariesInstalled('win32', 'x64');
            assert.strictEqual(typeof result, 'boolean');
        });

        it('should track installation state', async () => {
            const binary = {
                version: '1.10.31',
                platform: 'win32',
                arch: 'x64',
                type: 'gpu' as const,
                binaries: ['test.dll']
            };

            await stateManager.addInstalledBinary(binary);
            const state = stateManager.getState();
            assert.strictEqual(state.installedBinaries.length, 1);
            assert.strictEqual(state.installedBinaries[0].version, binary.version);
        });
    });

    describe('State Management', () => {
        it('should persist state changes', async () => {
            const newState = {
                targetVersion: '1.10.31',
                currentVersion: '1.10.31',
                lastCheck: new Date().toISOString(),
                installedBinaries: []
            };

            await stateManager.setState(newState);
            const state = stateManager.getState();
            assert.strictEqual(state.currentVersion, newState.currentVersion);
        });

        it('should handle state reset', async () => {
            await stateManager.setState({
                currentVersion: '1.10.31',
                targetVersion: '1.10.31',
                lastCheck: new Date().toISOString(),
                installedBinaries: []
            });

            await stateManager.reset();
            const state = stateManager.getState();
            assert.strictEqual(state.currentVersion, '1.10.30');
        });
    });

    describe('Version Migration', () => {
        it('should handle version migration correctly', async () => {
            // Add migration test
            await migrateVersionState();
            const state = await stateManager.getState();
            assert.notStrictEqual(state.currentVersion, '0.0.0');
        });
    });
}); 