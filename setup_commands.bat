@echo off
REM Create root directory (comment out if already exists)
REM mkdir tts_stt_cursor

REM Check if already in the tts_stt_cursor directory
for %%i in ("%cd%") do if /i "%%~nxi"=="tts_stt_cursor" (
    echo Already in the tts_stt_cursor directory.
) else (
    REM Check if directory exists before changing into it
    if exist tts_stt_cursor (
        cd tts_stt_cursor
    ) else (
        echo Directory tts_stt_cursor does not exist.
        exit /b 1
    )
)

REM Clean existing installations
rmdir /s /q node_modules 2>nul
del package-lock.json 2>nul
call npm cache clean --force

REM Install dependencies with latest stable versions
call npm install --save-dev @types/vscode
call npm install --save-dev @types/node
call npm install --save-dev typescript
call npm install --save-dev @typescript-eslint/eslint-plugin
call npm install --save-dev @typescript-eslint/parser
call npm install --save-dev eslint

REM Create directory structure
mkdir .vscode 2>nul
mkdir src\webview 2>nul
mkdir out 2>nul
mkdir media 2>nul
mkdir node_modules 2>nul

REM Create initial files
type nul > .gitignore
type nul > package.json
type nul > tsconfig.json
type nul > README.md
type nul > CHANGELOG.md
type nul > LICENSE
type nul > src\extension.ts
type nul > src\webview\index.html
type nul > src\webview\script.js
type nul > src\webview\style.css

REM Create additional media files
type nul > media\icon.png
type nul > media\microphone.svg
type nul > media\speaker.svg

REM Verify installation
call npm list @types/node @types/vscode

REM Compile TypeScript
call npm run compile

echo Setup completed!
pause 