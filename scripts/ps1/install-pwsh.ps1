# Check if PowerShell 7+ is already installed
$pwshPath = Get-Command pwsh -ErrorAction SilentlyContinue
if ($pwshPath) {
    $version = & pwsh -Command '$PSVersionTable.PSVersion.ToString()'
    Write-Host "✅ PowerShell $version is already installed"
    exit 0
}

Write-Host "PowerShell 7+ installation options:`n"
Write-Host "1. Manual Installation (Recommended):"
Write-Host "   Download: https://github.com/PowerShell/PowerShell/releases/latest"
Write-Host "   Look for: PowerShell-7.4.1-win-x64.msi`n"

Write-Host "2. Microsoft Store:"
Write-Host "   Store link: ms-windows-store://pdp/?ProductId=9MZ1SNWT0N5D`n"

Write-Host "3. Using winget (requires App Installer):"
$winget = Get-Command winget -ErrorAction SilentlyContinue
if ($winget) {
    Write-Host "   Run: winget install Microsoft.PowerShell"
} else {
    Write-Host "   First install App Installer from Microsoft Store:"
    Write-Host "   Store link: ms-windows-store://pdp/?ProductId=9nblggh4nns1"
    Write-Host "   Then run this script again"
}

Write-Host "`nAfter installation, restart your terminal and run: npm run refresh" 