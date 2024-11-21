import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');
        const extensionTestsPath = path.resolve(__dirname, './suite/index');
        
        const launchArgs = [
            '--disable-extensions',
            '--enable-proposed-api=gabriel-filincowsky.tts-stt-cursor',
            path.resolve(__dirname, '../../')
        ];

        await runTests({ 
            extensionDevelopmentPath, 
            extensionTestsPath,
            launchArgs
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main(); 