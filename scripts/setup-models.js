const fs = require('fs');
const path = require('path');

function setupModels() {
    try {
        const modelDirs = ['stt', 'tts'];
        const baseDir = path.join(__dirname, '..', 'models');

        // Ensure base models directory exists
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
        }

        // Create model type directories
        modelDirs.forEach(dir => {
            const fullPath = path.join(baseDir, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        });

        console.log('Model directories created successfully');
        return true;
    } catch (error) {
        console.error('Error setting up model directories:', error);
        return false;
    }
}

// Run setup and handle exit code
if (!setupModels()) {
    process.exit(1);
} 