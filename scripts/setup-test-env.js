const fs = require('fs');
const path = require('path');

// Create test directories
const testDirs = [
    'test/fixtures/models/stt',
    'test/fixtures/models/tts',
    'test/fixtures/configs'
];

testDirs.forEach(dir => {
    const fullPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
});

// Create test version file
const versionInfo = {
    sherpaNode: "1.10.30",
    binaries: "0.0.0",
    lastVerified: new Date().toISOString(),
    platform: {},
    api: {
        lastCheck: new Date().toISOString(),
        rateLimit: {
            remaining: 60,
            reset: 0
        }
    }
};

fs.writeFileSync(
    path.join(__dirname, '..', 'test', 'fixtures', 'sherpa-version.json'),
    JSON.stringify(versionInfo, null, 2)
);

console.log('Test environment setup complete'); 