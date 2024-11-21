# Save this script as 'GenerateDirectoryStructure.ps1'

# Get the current directory
$CurrentDirectory = Get-Location
Write-Host "Current Directory: $CurrentDirectory"

# Define the output file
$OutputFile = Join-Path -Path $CurrentDirectory -ChildPath "directory_structure.txt"
Write-Host "Output File: $OutputFile"

# Function to check if a file/directory should be excluded
function Should-Exclude {
    param (
        [string]$Name
    )
    
    $excludePatterns = @(
        '^\.git$',
        '^\.vscode$',
        '^node_modules$',
        '^\.vscode-test$',
        '^\..+',  # Hidden files/directories
        '^package-lock\.json$'
    )

    foreach ($pattern in $excludePatterns) {
        if ($Name -match $pattern) {
            return $true
        }
    }
    return $false
}

# Function to check if a file is relevant
function Is-RelevantFile {
    param (
        [string]$Name
    )
    
    $relevantExtensions = @(
        '\.ts$',
        '\.js$',
        '\.json$',
        '\.md$',
        '\.ps1$'
    )

    foreach ($ext in $relevantExtensions) {
        if ($Name -match $ext) {
            return $true
        }
    }
    return $false
}

# Function to recursively get directory structure
function Get-DirectoryStructure {
    param (
        [string]$Path,
        [int]$IndentLevel = 0
    )

    $items = Get-ChildItem -Path $Path

    foreach ($item in $items) {
        if (Should-Exclude $item.Name) {
            continue
        }

        $indent = "    " * $IndentLevel
        
        if ($item.PSIsContainer) {
            # Always show directories (except excluded ones)
            Add-Content -Path $OutputFile -Value ("$indent├── $($item.Name)/")
            Get-DirectoryStructure -Path $item.FullName -IndentLevel ($IndentLevel + 1)
        }
        elseif (Is-RelevantFile $item.Name) {
            # Only show relevant files
            Add-Content -Path $OutputFile -Value ("$indent├── $($item.Name)")
        }
    }
}

# Initialize
$OutputFile = "project_structure.txt"
if (Test-Path $OutputFile) {
    Remove-Item $OutputFile
}

# Add header
$projectName = Split-Path -Leaf (Get-Location)
Add-Content -Path $OutputFile -Value "$projectName/"

# Generate structure
Get-DirectoryStructure -Path (Get-Location)

Write-Host "Directory structure has been saved to $OutputFile"