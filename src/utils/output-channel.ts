import * as vscode from 'vscode';

// Create and show the output channel immediately
const outputChannel = vscode.window.createOutputChannel('TTS-STT Debug');
outputChannel.show(true); // Force the output channel to be visible

// Add timestamp to log messages
const enhancedOutputChannel = {
    appendLine: (message: string) => {
        const timestamp = new Date().toISOString();
        outputChannel.appendLine(`[${timestamp}] ${message}`);
    },
    show: () => outputChannel.show(true),
    dispose: () => outputChannel.dispose()
};

export { enhancedOutputChannel as outputChannel }; 