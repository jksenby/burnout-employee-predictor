const API_URL = 'http://localhost:8000/predict';

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const result = document.getElementById('result');
const resultLabel = document.getElementById('resultLabel');
const progressBar = document.getElementById('progressBar');
const resultDetails = document.getElementById('resultDetails');
const audioPlayer = document.getElementById('audioPlayer');

let selectedFile = null;

uploadArea.addEventListener('click', () => {
    fileInput.click();
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }

    file = e.target.files[0];

    if(file) {
        const fileURL = URL.createObjectURL(file);
        audioPlayer.src = fileURL
    }
});

function handleFile(file) {
    selectedFile = file;
    
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    fileInfo.innerHTML = `
        <strong>Selected:</strong> ${file.name}<br>
        <strong>Size:</strong> ${sizeMB} MB<br>
        <strong>Type:</strong> ${file.type || 'audio'}
    `;
    fileInfo.classList.add('show');
    
    analyzeBtn.disabled = false;
    
    result.classList.remove('show');
}

analyzeBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    
    loading.classList.add('show');
    result.classList.remove('show');
    analyzeBtn.disabled = true;
    
    try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Analysis failed');
        }
        
        const data = await response.json();
        
        displayResults(data);
        
    } catch (error) {
        console.error('Error:', error);
        alert(`Error analyzing audio: ${error.message}`);
    } finally {
        loading.classList.remove('show');
        analyzeBtn.disabled = false;
    }
});

function displayResults(data) {
    const { label, score, confidence, probabilities, features } = data;
    
    let riskClass = 'low';
    if (label.includes('Medium')) riskClass = 'medium';
    if (label.includes('High')) riskClass = 'high';
    
    result.className = `result show ${riskClass}`;
    resultLabel.textContent = label;

    const scorePercent = (score * 100).toFixed(0);
    progressBar.style.width = `${scorePercent}%`;
    
    const detailsHTML = `
        <strong>Risk Score:</strong> ${scorePercent}/100<br>
        <strong>Confidence:</strong> ${(confidence * 100).toFixed(1)}%<br>
        <br>
        <strong>Probability Distribution:</strong><br>
        ${Object.entries(probabilities).map(([level, prob]) => 
            `${level}: ${(prob * 100).toFixed(1)}%`
        ).join('<br>')}
        <br><br>
        <strong>Technical Features:</strong><br>
        Embedding Norm: ${features.embedding_norm.toFixed(2)}<br>
        Embedding Mean: ${features.embedding_mean_abs.toFixed(4)}<br>
        Positive Ratio: ${features.positive_ratio.toFixed(2)}<br>
        Max Abs: ${features.max_abs.toFixed(2)}<br>
        Skewness Approximation: ${features.skewness_approx.toFixed(2)}<br>
        Low Variability Risk: ${features.low_variability_risk.toFixed(2)}<br>
        Low Energy Risk: ${features.low_energy_risk.toFixed(2)}<br>
        Skew Risk: ${features.skew_risk.toFixed(2)}
    `;
    
    resultDetails.innerHTML = detailsHTML;
}
