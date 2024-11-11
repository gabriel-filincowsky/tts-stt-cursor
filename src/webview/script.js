(function () {
    const vscode = acquireVsCodeApi();
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    // UI Elements
    const sttButton = document.getElementById('start-stt');
    const ttsButton = document.getElementById('start-tts');
    const statusElement = document.createElement('div');
    statusElement.className = 'status';
    document.body.appendChild(statusElement);

    // STT Functionality
    sttButton.addEventListener('click', () => {
        if (!isRecording) {
            startSTT();
        } else {
            stopSTT();
        }
    });

    function startSTT() {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
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
            })
            .catch(err => {
                console.error('Error accessing microphone:', err);
                vscode.postMessage({
                    command: 'error',
                    text: 'Failed to access microphone: ' + err.message
                });
                statusElement.textContent = 'Error: Failed to access microphone';
            });
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
})();

