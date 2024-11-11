(function () {
    const vscode = acquireVsCodeApi();
    let mediaRecorder = null;
    let audioChunks = [];

    document.getElementById('start-stt').addEventListener('click', () => {
        if (!mediaRecorder) {
            startSTT();
        } else {
            stopSTT();
        }
    });

    document.getElementById('start-tts').addEventListener('click', () => {
        const text = prompt('Enter text for TTS:');
        if (text) {
            vscode.postMessage({ command: 'startTTS', text: text });
        }
    });

    function startSTT() {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                const button = document.getElementById('start-stt');
                button.textContent = '⏹️ Stop STT';
                
                mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.ondataavailable = (event) => {
                    audioChunks.push(event.data);
                };
                
                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    const reader = new FileReader();
                    reader.readAsArrayBuffer(audioBlob);
                    reader.onloadend = () => {
                        vscode.postMessage({
                            command: 'startSTT',
                            audioData: reader.result
                        });
                    };
                    audioChunks = [];
                };
                
                mediaRecorder.start(1000); // Collect data every second
            })
            .catch(err => {
                console.error('Error accessing microphone:', err);
                vscode.postMessage({
                    command: 'error',
                    text: 'Failed to access microphone: ' + err.message
                });
            });
    }

    function stopSTT() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            mediaRecorder = null;
            
            const button = document.getElementById('start-stt');
            button.textContent = '🎤 Start STT';
        }
    }

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'playAudio':
                playAudio(message.audioData);
                break;
        }
    });

    function playAudio(audioData) {
        const audioContext = new AudioContext();
        audioContext.decodeAudioData(audioData, buffer => {
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(0);
        });
    }
})();
