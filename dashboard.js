document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('saved') === '1') {
        showSavedBanner();
        history.replaceState({}, '', 'index.html');
    }

    // Render immediately from localStorage so the page isn't blank
    renderNudge();
    renderPrompt();
    renderStats();
    renderRecentEntries();
    setupGoalEditor();

    // Then pull from Firestore and refresh with the latest data
    syncFromFirestore().then(synced => {
        if (synced) {
            renderNudge();
            renderStats();
            renderRecentEntries();
        }
    });
});

function showSavedBanner() {
    const banner = document.createElement('div');
    banner.className = 'saved-banner';
    banner.textContent = '✓ Entry saved — great session!';
    document.body.prepend(banner);
    setTimeout(() => {
        banner.style.transition = 'opacity 0.5s';
        banner.style.opacity = '0';
        setTimeout(() => banner.remove(), 500);
    }, 2500);
}

function renderNudge() {
    const days = getDaysSinceLastSession();
    const nudge = document.getElementById('nudge');

    if (days === null) {
        nudge.style.display = 'block';
        nudge.className = 'nudge-banner nudge-welcome';
        nudge.textContent = 'Welcome to BookWriter! Ready to start your first session?';
    } else if (days === 0) {
        nudge.style.display = 'none';
    } else if (days === 1) {
        nudge.style.display = 'block';
        nudge.className = 'nudge-banner nudge-positive';
        nudge.textContent = 'You wrote yesterday — your streak is alive. Keep it going!';
    } else {
        nudge.style.display = 'block';
        nudge.className = 'nudge-banner nudge-gentle';
        nudge.textContent = `You last wrote ${days} days ago. Your story is waiting for you.`;
    }
}

function renderPrompt() {
    document.getElementById('todayPrompt').textContent = getTodayPrompt();
}

function renderStats() {
    const streak     = calculateStreak();
    const totalWords = getTotalWords();
    const sessions   = getTotalSessions();
    const todayWords = getTodayWords();
    const settings   = getSettings();
    const goal       = settings.dailyWordGoal || 300;

    document.getElementById('streakStat').textContent     = streak;
    document.getElementById('totalWordsStat').textContent = totalWords.toLocaleString();
    document.getElementById('sessionsStat').textContent   = sessions;
    document.getElementById('todayWordsStat').textContent = todayWords.toLocaleString();
    document.getElementById('goalDisplay').textContent    = goal.toLocaleString();

    const pct = Math.min(100, Math.round((todayWords / goal) * 100));
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressLabel').textContent =
        `${todayWords.toLocaleString()} / ${goal.toLocaleString()} words written today`;
}

function renderRecentEntries() {
    const entries   = getEntries().slice(-3).reverse();
    const container = document.getElementById('recentEntries');

    if (entries.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-style:italic;font-size:0.9rem">' +
            'No entries yet — your first saved session will appear here.</p>';
        return;
    }

    container.innerHTML = '';
    entries.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'recent-card';

        const allChips = [
            ...entry.tags.characters.map(c => `<span class="chip chip-character">${esc(c)}</span>`),
            ...entry.tags.plotPoints.map(p => `<span class="chip chip-plot">${esc(p)}</span>`),
            ...entry.tags.keywords.map(k => `<span class="chip chip-keyword">${esc(k)}</span>`)
        ].join('');

        const preview = entry.text.substring(0, 130);
        card.innerHTML = `
            <div class="recent-card-header">
                <span class="recent-date">${formatDateShort(entry.date)}</span>
                <span class="recent-words">${entry.wordCount.toLocaleString()} words</span>
            </div>
            ${allChips ? `<div class="recent-tags">${allChips}</div>` : ''}
            <p class="recent-preview">${esc(preview)}${entry.text.length > 130 ? '…' : ''}</p>
        `;
        container.appendChild(card);
    });
}

function setupGoalEditor() {
    const modal     = document.getElementById('goalModal');
    const input     = document.getElementById('goalInput');
    const editBtn   = document.getElementById('editGoalBtn');
    const saveBtn   = document.getElementById('saveGoalBtn');
    const cancelBtn = document.getElementById('cancelGoalBtn');

    editBtn.addEventListener('click', () => {
        input.value = getSettings().dailyWordGoal || 300;
        modal.style.display = 'flex';
        input.focus();
        input.select();
    });

    cancelBtn.addEventListener('click', () => { modal.style.display = 'none'; });

    saveBtn.addEventListener('click', () => {
        const goal = parseInt(input.value);
        if (goal && goal >= 10) {
            saveSettings({ dailyWordGoal: goal });
            modal.style.display = 'none';
            renderStats();
        }
    });

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') saveBtn.click();
        if (e.key === 'Escape') cancelBtn.click();
    });

    modal.addEventListener('click', e => {
        if (e.target === modal) modal.style.display = 'none';
    });
}

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
