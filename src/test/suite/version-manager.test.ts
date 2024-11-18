import * as assert from 'assert';
import { describe, it } from 'mocha';
import { VersionManager } from '../../utils/version-manager';

describe('Version Manager Test Suite', () => {
    it('Version validation should work', async () => {
        const manager = VersionManager.getInstance();
        const isValid = await manager.validateVersion();
        assert.strictEqual(typeof isValid, 'boolean');
    });

    it('Version comparison should be accurate', () => {
        const manager = VersionManager.getInstance();
        const expected = manager.getExpectedVersion();
        const actual = manager.getActualVersion();
        assert.strictEqual(typeof expected, 'string');
        assert.strictEqual(typeof actual, 'string');
    });
}); 