import * as assert from 'assert';
import { describe, it, before, after } from 'mocha';
import * as sinon from 'sinon';
import { GPUManager } from '../../src/utils/gpu-manager';
import { GPUContext } from '../../src/utils/gpu-context';

describe('GPU Management Test Suite', () => {
    let gpuManager: GPUManager;
    let gpuContext: GPUContext;
    let sandbox: sinon.SinonSandbox;

    before(() => {
        gpuManager = GPUManager.getInstance();
        gpuContext = GPUContext.getInstance();
        sandbox = sinon.createSandbox();
    });

    after(() => {
        sandbox.restore();
    });

    describe('GPU Detection', () => {
        it('should detect GPU availability', async () => {
            const hasGPU = await gpuManager.checkGPUAvailability();
            assert.strictEqual(typeof hasGPU, 'boolean');
        });

        it('should get correct binary pattern', async () => {
            const pattern = await gpuManager.getGPUBinaryPattern('1.10.30');
            assert.ok(pattern !== null);
        });
    });

    describe('GPU Context Management', () => {
        it('should initialize GPU context', async () => {
            await assert.doesNotReject(async () => {
                await gpuContext.initialize();
            });
        });

        it('should cleanup GPU context', async () => {
            await assert.doesNotReject(async () => {
                await gpuContext.cleanup();
            });
        });
    });

    describe('GPU Fallback Mechanism', () => {
        beforeEach(() => {
            sandbox.restore();
        });

        it('should handle missing GPU gracefully', async () => {
            sandbox.stub(gpuManager, 'checkGPUAvailability').resolves(false);
            
            sandbox.stub(gpuManager as any, 'checkCUDA').resolves({ available: false });
            
            const pattern = await gpuManager.getGPUBinaryPattern('1.10.30');
            assert.ok(pattern === null || !pattern.includes('-cuda'));
        });

        it('should detect and use GPU when available', async () => {
            sandbox.stub(gpuManager, 'checkGPUAvailability').resolves(true);
            sandbox.stub(gpuManager as any, 'checkCUDA').resolves({ 
                available: true, 
                version: '11.0' 
            });
            
            const pattern = await gpuManager.getGPUBinaryPattern('1.10.30');
            assert.ok(pattern !== null && pattern.includes('-cuda'));
        });
    });

    after(async () => {
        await gpuContext.cleanup();
    });
}); 