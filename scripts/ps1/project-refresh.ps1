# Version check with helpful message
$requiredVersion = [Version]"7.0"
$currentVersion = $PSVersionTable.PSVersion

if ($currentVersion -lt $requiredVersion) {
    Write-Host "⚠️ This script requires PowerShell $requiredVersion or later." -ForegroundColor Yellow
    Write-Host "Current version: $currentVersion" -ForegroundColor Yellow
    Write-Host "`nTo install PowerShell 7+:" -ForegroundColor Cyan
    Write-Host "1. Run: winget install Microsoft.PowerShell" -ForegroundColor White
    Write-Host "2. Restart your terminal" -ForegroundColor White
    Write-Host "3. Try again" -ForegroundColor White
    exit 1
}

# Script Configuration
$script:TimeStamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$script:ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
$script:LogDir = Join-Path $ProjectRoot "logs/refresh"
$script:VerboseLog = Join-Path $LogDir "verbose_${TimeStamp}.log"
$script:ConciseLog = Join-Path $LogDir "concise_${TimeStamp}.log"
$script:ErrorCount = 0
$script:WarningCount = 0

# Helper function to count errors and warnings in output
function Update-ErrorWarningCount {
    param([string]$Output)
    
    # Count TypeScript errors
    $script:ErrorCount += (@($Output | Select-String -Pattern "error TS\d+:" -AllMatches).Matches).Count
    
    # Count npm errors
    $script:ErrorCount += (@($Output | Select-String -Pattern "npm ERR!" -AllMatches).Matches).Count
    
    # Count general errors
    $script:ErrorCount += (@($Output | Select-String -Pattern "error:|failed:|❌" -AllMatches).Matches).Count
    
    # Count warnings
    $script:WarningCount += (@($Output | Select-String -Pattern "warning:|warn:|⚠️" -AllMatches).Matches).Count
}

# Initialize Logging
function Initialize-Logging {
    if (-not (Test-Path $LogDir)) {
        New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
    }
    
    # Create fresh log files with UTF-8 encoding and BOM
    $initialContent = @"
=== Project Refresh Log (${TimeStamp}) ===
Script started at: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Working directory: $(Get-Location)

System Information:
PowerShell Version: $($PSVersionTable.PSVersion)
OS: $([System.Environment]::OSVersion.VersionString)
Node Version: $(node --version)
NPM Version: $(npm --version)

"@
    [System.IO.File]::WriteAllText($VerboseLog, $initialContent, [System.Text.UTF8Encoding]::new($true))
    [System.IO.File]::WriteAllText($ConciseLog, $initialContent, [System.Text.UTF8Encoding]::new($true))
}

# Logging Functions
function Write-StepHeader {
    param([string]$Message)
    $header = "`n=== $Message ===`n"
    # Write to both logs and console
    Add-Content -Path $VerboseLog -Value $header
    Add-Content -Path $ConciseLog -Value $header
    Write-Host $header
}

function Write-StepResult {
    param(
        [string]$Step,
        [bool]$Success,
        [string]$Details = "",
        [switch]$Important
    )
    
    $icon = if ($Success) { "✅" } else { "❌" }
    $message = "$icon $Step"
    
    # Update error/warning counts
    if (-not [string]::IsNullOrEmpty($Details)) {
        Update-ErrorWarningCount $Details
    }
    
    # Format verbose message with full details
    $verboseMessage = @"
$message
Command executed at: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Exit Code: $LASTEXITCODE
Full output:
----------------------------------------
$($Details ?? "(no output)")
----------------------------------------

"@

    # Format concise message
    $conciseMessage = $message
    if (-not $Success) {
        # Extract only error messages for concise log
        $errorLines = $Details -split "`n" |
            Where-Object { $_ -match "error TS\d+:|failed:|warning:|❌|⚠️" } |
            ForEach-Object { $_.Trim() }
        
        if ($errorLines) {
            $conciseMessage += "`nError Summary:"
            foreach ($line in $errorLines) {
                $conciseMessage += "`n   → $line"
            }
        }
    }

    # Always write complete details to verbose log
    Add-Content -Path $VerboseLog -Value $verboseMessage -Encoding UTF8

    # Write to concise log only important or error messages
    if ($Important -or -not $Success) {
        Add-Content -Path $ConciseLog -Value $conciseMessage -Encoding UTF8
    }

    # Display appropriate message in terminal
    Write-Host $message
    if (-not $Success) {
        Write-Host "   See logs for details" -ForegroundColor Yellow
        $script:ErrorCount++  # Increment error count for failed steps
    }
}

function Write-VerboseOutput {
    param(
        [string]$Message,
        [switch]$Important
    )
    
    # Update error/warning counts
    if (-not [string]::IsNullOrEmpty($Message)) {
        Update-ErrorWarningCount $Message
    }
    
    # Always write complete output to verbose log with timestamp
    Add-Content -Path $VerboseLog -Value @"
Command Output ($(Get-Date -Format "yyyy-MM-dd HH:mm:ss")):
----------------------------------------
$($Message ?? "(no output)")
----------------------------------------

"@ -Encoding UTF8
    
    # For concise log, only include important messages or errors/warnings
    if ($Important -or $Message -match "error|failed|warning|❌|⚠️") {
        $relevantLines = $Message -split "`n" |
            Where-Object { $_ -match "error TS\d+:|failed:|warning:|❌|⚠️|^>.*build" } |
            ForEach-Object { "   $_".Trim() }
        
        if ($relevantLines) {
            Add-Content -Path $ConciseLog -Value $relevantLines -Encoding UTF8
        }
    }
    
    # Show in terminal if verbose preference is set
    if ($VerbosePreference -eq 'Continue') {
        Write-Host $Message
    }
}

# Initialize
Initialize-Logging

try {
    # 1. Clean Build Environment
    Write-StepHeader "Clean Build Environment"
    
    $cleanTargets = @("out", "node_modules", "package-lock.json")
    foreach ($target in $cleanTargets) {
        if (Test-Path $target) {
            # Capture but minimize the command output
            $output = Remove-Item -Recurse -Force $target -Verbose 4>&1
            # Only log the basic result, not the full cleanup details
            Write-StepResult "Clean $target" $true "Cleaned $target successfully"
        }
    }

    # 2. Install Dependencies
    Write-StepHeader "Install Dependencies"
    
    # Capture both stdout and stderr
    $output = & {
        $ErrorActionPreference = 'Continue'
        $output = npm install 2>&1
        $output | Out-String
    }
    Write-VerboseOutput $output
    if ($LASTEXITCODE -eq 0) {
        Write-StepResult "Dependencies installation" $true $output -Important
    } else {
        Write-StepResult "Dependencies installation" $false $output
        throw "Dependencies installation failed"
    }

    # 3. TypeScript Build
    Write-StepHeader "TypeScript Build"
    
    $output = & {
        $ErrorActionPreference = 'Continue'
        Write-Host "> Building TypeScript projects..." -ForegroundColor Cyan
        $output = npm run compile 2>&1
        $output | Out-String
    }
    Write-VerboseOutput $output
    
    if ($LASTEXITCODE -eq 0) {
        Write-StepResult "TypeScript compilation" $true $output -Important
    } else {
        Write-StepResult "TypeScript compilation" $false $output
        throw "TypeScript compilation failed"
    }

    # 4. Test Environment Setup
    Write-StepHeader "Test Environment Setup"
    
    $output = & {
        $ErrorActionPreference = 'Continue'
        $output = npm run setup-test-env 2>&1
        $output | Out-String
    }
    Write-VerboseOutput $output
    if ($LASTEXITCODE -eq 0) {
        Write-StepResult "Test environment setup" $true $output
    } else {
        Write-StepResult "Test environment setup" $false $output
        throw "Test environment setup failed"
    }

    # 5. Run Tests
    Write-StepHeader "Test Execution"
    
    $output = & {
        $ErrorActionPreference = 'Continue'
        $output = npm test 2>&1
        $output | Out-String
    }
    Write-VerboseOutput $output
    if ($LASTEXITCODE -eq 0) {
        Write-StepResult "Test suite" $true $output -Important
    } else {
        Write-StepResult "Test suite" $false $output
        throw "Test execution failed"
    }

} catch {
    # Capture full error details
    $errorDetails = @"
Error Message: $($_.Exception.Message)
Error Type: $($_.Exception.GetType().FullName)
Stack Trace:
$($_.ScriptStackTrace)
"@
    Write-StepResult "Project refresh" $false $errorDetails -Important
} finally {
    # Write Summary
    Write-StepHeader "Execution Summary"
    $summary = @"
Completed with:
- Errors: $script:ErrorCount
- Warnings: $script:WarningCount

Logs available at:
Verbose: $(Resolve-Path -Relative $VerboseLog)
Concise: $(Resolve-Path -Relative $ConciseLog)
"@
    
    # Write summary to both logs and console
    Add-Content -Path $VerboseLog -Value $summary -Encoding UTF8
    Add-Content -Path $ConciseLog -Value $summary -Encoding UTF8
    Write-Host $summary

    # Open logs in VS Code if available
    if (Get-Command code -ErrorAction SilentlyContinue) {
        Write-Host "`nOpen logs in VS Code:"
        Write-Host "code `"$VerboseLog`""
        Write-Host "code `"$ConciseLog`""
    }
} 