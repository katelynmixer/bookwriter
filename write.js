// ── State ──────────────────────────────────────────────────────
const DRAFT_KEY = 'bookwriter_draft';

let totalSeconds     = 0;
let remainingSeconds = 0;
let timerInterval    = null;
let isPaused         = false;
let sessionStartTime = null;
let draftSaveTimer   = null;

// Tag arrays — filled by setupTagInput()
const charTags = [];
const plotTags = [];
const keyTags  = [];

// ── DOM refs ────────────────────────────────────────────────────
const timerModal      = document.getElementById('timerModal');
const writingInterface = document.getElementById('writingInterface');
const savePanel       = document.getElementById('savePanel');
const timerDisplay    = document.getElementById('timerDisplay');
const pauseBtn        = document.getElementById('pauseBtn');
const saveTagBtn      = document.getElementById('saveTagBtn');
const writeArea       = document.getElementById('writeArea');
const liveWordCount   = document.getElementById('liveWordCount');
const timerDoneMsg    = document.getElementById('timerDoneMsg');
const emptyWarning    = document.getElementById('emptyWarning');

// ── Initialization ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Show draft notice if one exists
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft && draft.trim()) {
        document.getElementById('draftNotice').classList.remove('hidden');
    }

    // Timer preset buttons
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', () => startSession(parseInt(btn.dataset.minutes)));
    });

    document.getElementById('startCustomBtn').addEventListener('click', () => {
        const mins = parseInt(document.getElementById('customMinutes').value);
        if (mins && mins >= 1 && mins <= 180) startSession(mins);
    });

    document.getElementById('customMinutes').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('startCustomBtn').click();
    });

    // Header controls
    pauseBtn.addEventListener('click', togglePause);
    saveTagBtn.addEventListener('click', openSavePanel);

    // Save panel controls
    document.getElementById('saveOverlay').addEventListener('click', closeSavePanel);
    document.getElementById('cancelSaveBtn').addEventListener('click', closeSavePanel);
    document.getElementById('confirmSaveBtn').addEventListener('click', handleSave);

    // Live word count + auto-save draft
    writeArea.addEventListener('input', () => {
        liveWordCount.textContent = countWords(writeArea.value) + ' words';
        scheduleDraftSave();
    });

    // Tag inputs
    setupTagInput('charInput', 'charChips', charTags, 'chip-character');
    setupTagInput('plotInput', 'plotChips', plotTags, 'chip-plot');
    setupTagInput('keyInput',  'keyChips',  keyTags,  'chip-keyword');
});

// ── Timer ───────────────────────────────────────────────────────
function startSession(minutes) {
    totalSeconds     = minutes * 60;
    remainingSeconds = totalSeconds;
    sessionStartTime = new Date();

    // Restore draft if it exists
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
        writeArea.value = draft;
        liveWordCount.textContent = countWords(draft) + ' words';
    }

    timerModal.classList.add('hidden');
    writingInterface.classList.remove('hidden');
    updateTimerDisplay();

    timerInterval = setInterval(tick, 1000);
    writeArea.focus();
}

function tick() {
    if (isPaused) return;
    remainingSeconds--;
    updateTimerDisplay();

    if (remainingSeconds <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        onTimerDone();
    }
}

function updateTimerDisplay() {
    const secs = Math.max(0, remainingSeconds);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    timerDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    timerDisplay.classList.toggle('timer-warning', remainingSeconds > 0 && remainingSeconds <= 300);
}

function togglePause() {
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    pauseBtn.classList.toggle('paused', isPaused);
}

function onTimerDone() {
    timerDisplay.classList.add('timer-done');
    timerDisplay.textContent = '00:00';
    timerDoneMsg.classList.remove('hidden');
    playChime();
}

function playChime() {
    try {
        const ctx = new AudioContext();
        [[528, 0], [660, 0.25], [528, 0.5]].forEach(([freq, delay]) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
            gain.gain.setValueAtTime(0.18, ctx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 1.1);
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 1.1);
        });
    } catch (e) {
        // Audio API not available — silence is fine
    }
}

// ── Draft auto-save ─────────────────────────────────────────────
function scheduleDraftSave() {
    clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(() => {
        localStorage.setItem(DRAFT_KEY, writeArea.value);
    }, 2000);
}

// ── Save panel ──────────────────────────────────────────────────
function openSavePanel() {
    if (!writeArea.value.trim()) {
        emptyWarning.classList.remove('hidden');
        setTimeout(() => emptyWarning.classList.add('hidden'), 3000);
        return;
    }

    // Populate autocomplete from saved characters and plot points
    const data = getData();
    populateDatalist('charSuggestions', data.characters);
    populateDatalist('plotSuggestions', data.plotPoints);

    savePanel.classList.remove('hidden');
    // Trigger CSS transition on next frame
    requestAnimationFrame(() => savePanel.classList.add('open'));
    document.getElementById('charInput').focus();
}

function closeSavePanel() {
    savePanel.classList.remove('open');
    setTimeout(() => savePanel.classList.add('hidden'), 300);
}

function populateDatalist(id, items) {
    const dl = document.getElementById(id);
    dl.innerHTML = items.map(item => `<option value="${escHtml(item)}">`).join('');
}

function handleSave() {
    const text = writeArea.value.trim();
    if (!text) {
        openSavePanel();
        return;
    }

    const sessionMinutes = sessionStartTime
        ? Math.round((new Date() - sessionStartTime) / 60000)
        : 0;

    addEntry({
        text,
        sessionMinutes,
        characters: [...charTags],
        plotPoints: [...plotTags],
        keywords:   [...keyTags],
        note: document.getElementById('noteInput').value.trim()
    });

    localStorage.removeItem(DRAFT_KEY);
    window.location.href = 'index.html?saved=1';
}

// ── Tag input helper ────────────────────────────────────────────
function setupTagInput(inputId, chipsId, tagsArray, chipClass) {
    const input  = document.getElementById(inputId);
    const chips  = document.getElementById(chipsId);

    const render = () => {
        chips.innerHTML = '';
        tagsArray.forEach((tag, i) => {
            const chip = document.createElement('span');
            chip.className = `chip ${chipClass}`;
            chip.textContent = tag + ' ';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'chip-remove';
            removeBtn.textContent = '×';
            removeBtn.setAttribute('aria-label', `Remove ${tag}`);
            removeBtn.addEventListener('click', () => {
                tagsArray.splice(i, 1);
                render();
            });

            chip.appendChild(removeBtn);
            chips.appendChild(chip);
        });
    };

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = input.value.trim();
            if (val && !tagsArray.includes(val)) {
                tagsArray.push(val);
                render();
            }
            input.value = '';
        }
    });
}

function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
