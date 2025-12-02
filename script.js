const audioFileInput = document.getElementById('audioInput');
const audioPlayer = document.getElementById('audioPlayer');
const submitButton = document.getElementById('submit');

let file;

audioFileInput.addEventListener('change', (event) => {
    file = event.target.files[0];

    if(file) {
        submitButton.disabled = false;
        const fileURL = URL.createObjectURL(file);
        audioPlayer.src = fileURL
    } else {
        submitButton.disabled = true;
    }
});

submitButton.addEventListener('click', (event) => {
    if(file) {
        const fileURL = URL.createObjectURL(file);
        const audioFile = new File([''], fileURL)
        sendAudio(audioFile);
    }
})

function sendAudio(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    fetch('http://localhost:8000', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(error => {
        console.error(error)
    })
}