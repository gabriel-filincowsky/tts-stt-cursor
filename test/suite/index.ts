import * as path from 'path';
import Mocha = require('mocha');
import { promisify } from 'util';
import { glob as globCb } from 'glob';

// Promisify glob
const glob = promisify(globCb);

export async function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'bdd',
        color: true,
        timeout: 60000
    });

    const testsRoot = path.resolve(__dirname, '.');

    try {
        // Use promisified glob with proper types
        const files = await glob('**/**.test.js', { 
            cwd: testsRoot 
        }) as string[];
        
        // Add files to the test suite
        files.forEach((f: string) => {
            mocha.addFile(path.resolve(testsRoot, f));
        });

        // Run the mocha test
        return new Promise<void>((resolve, reject) => {
            try {
                mocha.run((failures: number) => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    } else {
                        resolve();
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    } catch (err) {
        console.error('Error loading test files:', err);
        throw err;
    }
} 