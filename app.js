const STORAGE_KEY = 'bookwriter_data';

function getDefaultData() {
    return {
        entries: [],
        characters: [],
        plotPoints: [],
        settings: { dailyWordGoal: 300, lastSessionDate: null }
    };
}

function getData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : getDefaultData();
    } catch (e) {
        return getDefaultData();
    }
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // sync.js loads after this file, so we check before calling
    if (typeof syncToFirestore === 'function') syncToFirestore();
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

function countWords(text) {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
}

function formatDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateShort(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function addEntry({ text, sessionMinutes = 0, characters = [], plotPoints = [], keywords = [], note = '' }) {
    const data = getData();

    const entry = {
        id: generateId(),
        text: text.trim(),
        wordCount: countWords(text),
        date: getTodayDate(),
        sessionMinutes,
        tags: { characters, plotPoints, keywords },
        note: note.trim()
    };

    data.entries.push(entry);
    characters.forEach(c => { if (c && !data.characters.includes(c)) data.characters.push(c); });
    plotPoints.forEach(p => { if (p && !data.plotPoints.includes(p)) data.plotPoints.push(p); });
    data.settings.lastSessionDate = getTodayDate();

    saveData(data);
    return entry;
}

function getEntries() {
    return getData().entries;
}

function calculateStreak() {
    const entries = getEntries();
    if (entries.length === 0) return 0;

    const writingDays = new Set(entries.map(e => e.date));
    const today = getTodayDate();
    const yd = new Date();
    yd.setDate(yd.getDate() - 1);
    const yesterday = yd.toISOString().split('T')[0];

    // Streak is only "alive" if you wrote today or yesterday
    const startDate = writingDays.has(today) ? today
        : writingDays.has(yesterday) ? yesterday
        : null;
    if (!startDate) return 0;

    let streak = 0;
    const start = new Date(startDate + 'T12:00:00');
    for (let i = 0; i < 365; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() - i);
        if (writingDays.has(d.toISOString().split('T')[0])) {
            streak++;
        } else {
            break;
        }
    }
    return streak;
}

function getTodayWords() {
    const today = getTodayDate();
    return getEntries().filter(e => e.date === today).reduce((sum, e) => sum + e.wordCount, 0);
}

function getTotalWords() {
    return getEntries().reduce((sum, e) => sum + e.wordCount, 0);
}

function getTotalSessions() {
    return getEntries().length;
}

function getDaysSinceLastSession() {
    const { lastSessionDate } = getData().settings;
    if (!lastSessionDate) return null;
    const today = new Date(getTodayDate() + 'T12:00:00');
    const last = new Date(lastSessionDate + 'T12:00:00');
    return Math.floor((today - last) / (1000 * 60 * 60 * 24));
}

function getSettings() {
    return getData().settings;
}

function saveSettings(updates) {
    const data = getData();
    Object.assign(data.settings, updates);
    saveData(data);
}

function exportAsText() {
    const entries = getEntries();
    if (entries.length === 0) return 'No entries yet.';

    const lines = ['MY STORY — EXPORTED WRITING', '='.repeat(40), ''];
    entries.forEach((entry, i) => {
        lines.push(`ENTRY ${i + 1} — ${formatDate(entry.date)}`);
        lines.push(`Words: ${entry.wordCount} | Session: ${entry.sessionMinutes} min`);
        lines.push(`Characters: ${entry.tags.characters.join(', ') || 'none'}`);
        lines.push(`Plot point: ${entry.tags.plotPoints.join(', ') || 'none'}`);
        lines.push(`Keywords: ${entry.tags.keywords.join(', ') || 'none'}`);
        if (entry.note) lines.push(`Note: ${entry.note}`);
        lines.push('', entry.text, '', '-'.repeat(40), '');
    });
    return lines.join('\n');
}
