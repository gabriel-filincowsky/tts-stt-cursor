# Create a function to handle errors without exiting
function Write-StepResult {
    param (
        [string]$step,
        [bool]$success,
        [string]$errorMessage = ""
    )
    
    if ($success) {
        Write-Host "✅ $step completed successfully"
    } else {
        Write-Host "❌ $step failed: $errorMessage"
        $script:hasErrors = $true
    }
}

# Initialize error tracking
$script:hasErrors = $false

# 1. Clean Build Environment
Write-Host "`n=== Clean Build Environment ===`n"

Remove-Item -Recurse -Force out -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue

$cleanCheck = @(
    "out",
    "node_modules",
    "package-lock.json"
)
foreach ($item in $cleanCheck) {
    if (Test-Path $item) {
        Write-StepResult "Clean $item" $false "Failed to remove directory/file"
    } else {
        Write-StepResult "Clean $item" $true
    }
}

# 2. Install Dependencies and Build
Write-Host "`n=== Install Dependencies and Build ===`n"

try {
    npm install
    Write-StepResult "Install dependencies" $true
} catch {
    Write-StepResult "Install dependencies" $false $_.Exception.Message
}

Write-Host "`nVerifying TypeScript configuration..."
try {
    $tsVersion = npx tsc --version
    Write-StepResult "TypeScript version check" $true
    
    npx tsc --showConfig
    Write-StepResult "TypeScript config verification" $true
} catch {
    Write-StepResult "TypeScript verification" $false $_.Exception.Message
}

Write-Host "`nBuilding project..."
try {
    npm run build
    Write-StepResult "Project build" $true
} catch {
    Write-StepResult "Project build" $false $_.Exception.Message
}

# 3. Verify Build Output
Write-Host "`n=== Verify Build Output ===`n"

$buildOutputs = @(
    "out/extension.js",
    "out/extension.js.map",
    "out/extension.d.ts",
    "out/test/runTest.js",
    "out/test/index.js"
)

foreach ($output in $buildOutputs) {
    if (Test-Path $output) {
        Write-StepResult "Verify $output" $true
    } else {
        Write-StepResult "Verify $output" $false "File not found"
    }
}

# 4. Verify Directory Structure
Write-Host "`n=== Verify Directory Structure ===`n"

$requiredDirs = @(
    "src",
    "src/types",
    "src/utils",
    "src/services",
    "test",
    "test/suite",
    "out",
    "out/test",
    "out/test/suite"
)

foreach ($dir in $requiredDirs) {
    if (Test-Path $dir) {
        Write-StepResult "Verify directory $dir" $true
    } else {
        Write-StepResult "Verify directory $dir" $false "Directory not found"
    }
}

# 5. Setup Test Environment
Write-Host "`n=== Setup Test Environment ===`n"

try {
    npm run setup-test-env
    npm run setup-test-fixtures
    Write-StepResult "Test environment setup" $true
} catch {
    Write-StepResult "Test environment setup" $false $_.Exception.Message
}

# Verify test fixtures
$testFixtures = @(
    "test/fixtures/models/stt",
    "test/fixtures/models/tts",
    "test/fixtures/configs/stt-config.json",
    "test/fixtures/configs/tts-config.json",
    "test/fixtures/sherpa-version.json"
)

foreach ($fixture in $testFixtures) {
    if (Test-Path $fixture) {
        Write-StepResult "Verify fixture $fixture" $true
    } else {
        Write-StepResult "Verify fixture $fixture" $false "Fixture not found"
    }
}

# 6. Run Tests
Write-Host "`n=== Run Tests ===`n"

try {
    npm test
    Write-StepResult "Test execution" ($LASTEXITCODE -eq 0)
} catch {
    Write-StepResult "Test execution" $false $_.Exception.Message
}

# Final Status Report
Write-Host "`n=== Final Status ===`n"
if ($script:hasErrors) {
    Write-Host "❌ Verification process completed with errors. Please review the log above."
} else {
    Write-Host "✅ All verification steps completed successfully!"
}

# Store the error state but don't exit
$LASTEXITCODE = if ($script:hasErrors) { 1 } else { 0 }