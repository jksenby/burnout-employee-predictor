const API_URL = 'http://localhost:8000/predict';

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const audioPlayer = document.getElementById('audioPlayer');
const resultsContainer = document.getElementById('resultsContainer');

let selectedFile = null;

// ── Upload handlers ──

uploadArea.addEventListener('click', () => fileInput.click());

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
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    selectedFile = file;

    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    fileInfo.innerHTML = `
        <strong>📄 ${file.name}</strong> &nbsp;·&nbsp; ${sizeMB} MB &nbsp;·&nbsp; ${file.type || 'audio'}
    `;
    fileInfo.classList.add('show');

    const fileURL = URL.createObjectURL(file);
    audioPlayer.src = fileURL;
    audioPlayer.classList.add('show');

    analyzeBtn.disabled = false;
    resultsContainer.classList.remove('show');
}

// ── Analysis ──

analyzeBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    loading.classList.add('show');
    resultsContainer.classList.remove('show');
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

// ── Display Results ──

function displayResults(data) {
    const {
        label, score, confidence, probabilities,
        stream_contributions, emotions, dominant_emotion,
        text_analysis, transcript, acoustic_features, model_type
    } = data;

    // Risk Card
    let riskClass = 'low';
    if (label.includes('Medium')) riskClass = 'medium';
    if (label.includes('High')) riskClass = 'high';

    const riskCard = document.getElementById('riskCard');
    riskCard.className = `risk-card ${riskClass}`;

    document.getElementById('riskLabel').textContent = label;

    const scorePercent = (score * 100).toFixed(0);
    const confPercent = (confidence * 100).toFixed(1);

    document.getElementById('riskMeta').innerHTML = `
        <div class="risk-meta-item">Risk Score: <span>${scorePercent}/100</span></div>
        <div class="risk-meta-item">Confidence: <span>${confPercent}%</span></div>
        <div class="risk-meta-item">Dominant Emotion: <span>${capitalize(dominant_emotion || '—')}</span></div>
    `;

    document.getElementById('riskBarFill').style.width = `${scorePercent}%`;

    // Probability distribution
    const probContainer = document.getElementById('probContainer');
    const probEntries = Object.entries(probabilities || {});
    probContainer.innerHTML = probEntries.map(([level, prob], i) => {
        const cls = ['low-prob', 'med-prob', 'high-prob'][i] || '';
        return `
            <div class="prob-item ${cls}">
                <div class="prob-label">${level}</div>
                <div class="prob-value">${(prob * 100).toFixed(1)}%</div>
            </div>
        `;
    }).join('');

    // Model badge
    const badgeText = model_type === 'trained_gradient_boosting'
        ? 'TRAINED MODEL' : 'HEURISTIC FALLBACK';
    document.getElementById('modelBadge').innerHTML =
        `<span>${badgeText}</span>`;

    // Acoustic Panel
    const af = acoustic_features || {};
    document.getElementById('acousticMetrics').innerHTML = `
        ${metricRow('Pitch Mean', formatHz(af.pitch_mean))}
        ${metricRow('Pitch Std', formatHz(af.pitch_std))}
        ${metricRow('Pitch Range', formatHz(af.pitch_range))}
        ${metricRow('Energy Mean', formatFloat(af.energy_mean))}
        ${metricRow('Jitter', formatFloat(af.jitter))}
        ${metricRow('Shimmer', formatFloat(af.shimmer))}
        ${metricRow('HNR', formatDb(af.hnr))}
        ${metricRow('Speech Rate', formatRate(af.speech_rate))}
        ${metricRow('Pause Ratio', formatPercent(af.pause_ratio))}
    `;

    // Emotion Panel
    const emo = emotions || {};
    const emotionNames = ['angry', 'happy', 'sad', 'neutral'];
    document.getElementById('emotionBars').innerHTML = emotionNames.map(name => {
        const val = emo[name] || 0;
        const pct = (val * 100).toFixed(1);
        return `
            <div class="emotion-bar-container">
                <div class="emotion-bar-label">
                    <span class="name">${emotionIcon(name)} ${capitalize(name)}</span>
                    <span class="value">${pct}%</span>
                </div>
                <div class="emotion-bar">
                    <div class="emotion-bar-fill ${name}" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
    }).join('');

    // Linguistic Panel
    const ta = text_analysis || {};
    document.getElementById('linguisticMetrics').innerHTML = `
        ${metricRow('Sentiment', formatSentiment(ta.sentiment_polarity))}
        ${metricRow('Subjectivity', formatPercent(ta.sentiment_subjectivity))}
        ${metricRow('Absolutist Index', formatPercent(ta.absolutist_index))}
        ${metricRow('1st Person Ratio', formatPercent(ta.first_person_ratio))}
        ${metricRow('Negative Words', formatPercent(ta.negative_word_ratio))}
        ${metricRow('Hedging Ratio', formatPercent(ta.hedging_ratio))}
        ${metricRow('Word Count', ta.word_count || 0)}
        ${metricRow('Avg Word Length', formatFloat(ta.avg_word_length))}
    `;

    // Stream Contribution Panel
    const sc = stream_contributions || {};
    const streamConfig = [
        { key: 'hubert_acoustic', label: 'HuBERT Acoustic', cls: 'hubert' },
        { key: 'emotion', label: 'Emotion (SER)', cls: 'emotion' },
        { key: 'wavlm_prosody', label: 'WavLM Prosody', cls: 'wavlm' },
        { key: 'whisper_linguistic', label: 'Whisper Linguistic', cls: 'linguistic' },
    ];

    document.getElementById('streamBars').innerHTML = streamConfig.map(s => {
        const val = sc[s.key] || 0;
        return `
            <div class="stream-bar-container">
                <div class="stream-bar-label">
                    <span class="name">${s.label}</span>
                    <span class="value">${val.toFixed(1)}%</span>
                </div>
                <div class="stream-bar">
                    <div class="stream-bar-fill ${s.cls}" style="width: ${val}%"></div>
                </div>
            </div>
        `;
    }).join('');

    // Transcript
    document.getElementById('transcriptText').textContent =
        transcript || '(No transcript available)';

    // Show everything
    resultsContainer.classList.add('show');
}

// ── Helpers ──

function metricRow(name, value) {
    return `
        <div class="metric-row">
            <span class="metric-name">${name}</span>
            <span class="metric-value">${value}</span>
        </div>
    `;
}

function capitalize(str) {
    if (!str) return '—';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatFloat(v) {
    return v != null ? Number(v).toFixed(4) : '—';
}

function formatHz(v) {
    return v != null ? `${Number(v).toFixed(1)} Hz` : '—';
}

function formatDb(v) {
    return v != null ? `${Number(v).toFixed(1)} dB` : '—';
}

function formatRate(v) {
    return v != null ? `${Number(v).toFixed(1)} /s` : '—';
}

function formatPercent(v) {
    return v != null ? `${(Number(v) * 100).toFixed(1)}%` : '—';
}

function formatSentiment(v) {
    if (v == null) return '—';
    const n = Number(v);
    const label = n > 0.05 ? '😊 Positive' : n < -0.05 ? '😔 Negative' : '😐 Neutral';
    return `${label} (${n.toFixed(2)})`;
}

function emotionIcon(name) {
    const icons = { angry: '😠', happy: '😊', sad: '😢', neutral: '😐' };
    return icons[name] || '🔵';
}
