(function () {
    const vscode = acquireVsCodeApi();
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    // Initialize UI elements
    const sttButton = document.getElementById('start-stt');
    const ttsButton = document.getElementById('start-tts');
    const statusElement = document.getElementById('status');
    const permissionErrorElement = document.getElementById('permission-error');

    // Check initial microphone permission state
    navigator.permissions.query({ name: 'microphone' })
        .then(permissionStatus => {
            handlePermissionChange(permissionStatus.state);
            
            // Listen for permission changes
            permissionStatus.onchange = () => {
                handlePermissionChange(permissionStatus.state);
            };
        })
        .catch(error => {
            console.error('Error checking microphone permission:', error);
        });

    function handlePermissionChange(state) {
        switch (state) {
            case 'granted':
                permissionErrorElement.style.display = 'none';
                sttButton.disabled = false;
                break;
            case 'denied':
                permissionErrorElement.style.display = 'block';
                sttButton.disabled = true;
                break;
            case 'prompt':
                permissionErrorElement.style.display = 'none';
                sttButton.disabled = false;
                break;
        }
    }

    // STT Functionality
    sttButton.addEventListener('click', () => {
        if (!isRecording) {
            startSTT();
        } else {
            stopSTT();
        }
    });

    async function startSTT() {
        try {
            if (!isRecording) {
                statusElement.textContent = 'Requesting microphone access...';
                vscode.postMessage({ command: 'requestMicrophoneAccess' });
            } else {
                stopSTT();
            }
        } catch (error) {
            console.error('Error starting STT:', error);
            statusElement.textContent = 'Error: Failed to start recording';
        }
    }

    function stopSTT() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            isRecording = false;
            sttButton.textContent = '🎤 Start Recording';
            sttButton.classList.remove('recording');
        }
    }

    // TTS Functionality
    ttsButton.addEventListener('click', () => {
        const text = prompt('Enter text for TTS:');
        if (text) {
            statusElement.textContent = 'Generating speech...';
            vscode.postMessage({ command: 'startTTS', text: text });
        }
    });

    // Handle messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'microphoneAccessGranted':
                navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        channelCount: 1,
                        sampleRate: 16000,
                        echoCancellation: true,
                        noiseSuppression: true
                    }
                })
                .then(stream => {
                    handleRecordingStart(stream);
                })
                .catch(error => {
                    console.error('Error accessing microphone stream:', error);
                    statusElement.textContent = 'Error: Failed to access microphone';
                });
                break;

            case 'microphoneAccessDenied':
                console.error('Microphone access denied:', message.reason);
                statusElement.textContent = `Error: ${message.reason}`;
                permissionErrorElement.style.display = 'block';
                break;

            case 'transcriptionResult':
                statusElement.textContent = 'Transcription complete';
                setTimeout(() => {
                    statusElement.textContent = '';
                }, 3000);
                break;

            case 'playAudio':
                statusElement.textContent = 'Playing audio...';
                playAudio(message.audioData)
                    .then(() => {
                        statusElement.textContent = 'Audio complete';
                        setTimeout(() => {
                            statusElement.textContent = '';
                        }, 3000);
                    })
                    .catch(error => {
                        statusElement.textContent = 'Error playing audio';
                        console.error('Error playing audio:', error);
                    });
                break;
        }
    });

    async function playAudio(audioData) {
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(audioData);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);
        
        return new Promise((resolve) => {
            source.onended = resolve;
        });
    }

    function handleRecordingStart(stream) {
        isRecording = true;
        sttButton.textContent = '⏹️ Stop Recording';
        sttButton.classList.add('recording');
        statusElement.textContent = 'Recording...';

        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const reader = new FileReader();
            reader.onloadend = () => {
                vscode.postMessage({
                    command: 'startSTT',
                    audioData: reader.result
                });
                statusElement.textContent = 'Processing speech...';
            };
            reader.readAsArrayBuffer(audioBlob);
        };

        mediaRecorder.start();
    }
})();

