// ── Filter state ────────────────────────────────────────────────
let filters = {
    search:     '',
    characters: [],
    plotPoints: [],
    dateFrom:   '',
    dateTo:     '',
    sort:       'newest'
};

let selectedEntry = null;

// ── Boot ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Render from localStorage immediately, then refresh from Firestore
    buildFilterSidebar();
    renderEntries();
    setupEventListeners();

    syncFromFirestore().then(synced => {
        if (synced) {
            buildFilterSidebar();
            renderEntries();
        }
    });
});

// ── Sidebar ─────────────────────────────────────────────────────
function buildFilterSidebar() {
    const data = getData();

    buildCheckboxGroup('charFilters', 'charFilterSection', data.characters, 'characters');
    buildCheckboxGroup('plotFilters', 'plotFilterSection', data.plotPoints, 'plotPoints');
}

function buildCheckboxGroup(containerId, sectionId, items, filterKey) {
    if (items.length === 0) return;

    document.getElementById(sectionId).style.display = 'block';
    const container = document.getElementById(containerId);

    container.innerHTML = items.map(item => `
        <label class="filter-checkbox">
            <input type="checkbox" value="${esc(item)}"> ${esc(item)}
        </label>
    `).join('');

    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
            filters[filterKey] = Array.from(
                container.querySelectorAll('input:checked')
            ).map(el => el.value);
            renderEntries();
        });
    });
}

// ── Filtering & sorting ─────────────────────────────────────────
function getFilteredEntries() {
    let entries = getEntries();

    if (filters.search) {
        const q = filters.search.toLowerCase();
        entries = entries.filter(e =>
            e.text.toLowerCase().includes(q) ||
            e.tags.characters.some(c => c.toLowerCase().includes(q)) ||
            e.tags.plotPoints.some(p => p.toLowerCase().includes(q)) ||
            e.tags.keywords.some(k => k.toLowerCase().includes(q)) ||
            (e.note && e.note.toLowerCase().includes(q))
        );
    }

    if (filters.characters.length > 0) {
        entries = entries.filter(e =>
            filters.characters.every(c => e.tags.characters.includes(c))
        );
    }

    if (filters.plotPoints.length > 0) {
        entries = entries.filter(e =>
            filters.plotPoints.every(p => e.tags.plotPoints.includes(p))
        );
    }

    if (filters.dateFrom) {
        entries = entries.filter(e => e.date >= filters.dateFrom);
    }

    if (filters.dateTo) {
        entries = entries.filter(e => e.date <= filters.dateTo);
    }

    switch (filters.sort) {
        case 'oldest':   entries.sort((a, b) =>  a.date.localeCompare(b.date)); break;
        case 'longest':  entries.sort((a, b) =>  b.wordCount - a.wordCount);    break;
        case 'shortest': entries.sort((a, b) =>  a.wordCount - b.wordCount);    break;
        default:         entries.sort((a, b) =>  b.date.localeCompare(a.date)); break;
    }

    return entries;
}

// ── Render entries ──────────────────────────────────────────────
function renderEntries() {
    const entries   = getFilteredEntries();
    const container = document.getElementById('entriesList');
    const countEl   = document.getElementById('entryCount');

    countEl.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;

    if (getEntries().length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Your library is empty.</p>
                <p style="margin-top:0.5rem">
                    <a href="write.html" class="btn btn-primary" style="margin-top:0.75rem">Start your first session</a>
                </p>
            </div>`;
        return;
    }

    if (entries.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No entries match your current filters.</p></div>';
        return;
    }

    container.innerHTML = '';
    entries.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'entry-card';

        const tagsHtml = [
            ...entry.tags.characters.map(c => `<span class="chip chip-character">${esc(c)}</span>`),
            ...entry.tags.plotPoints.map(p => `<span class="chip chip-plot">${esc(p)}</span>`),
            ...entry.tags.keywords.map(k => `<span class="chip chip-keyword">${esc(k)}</span>`)
        ].join('');

        const preview = entry.text.substring(0, 220);

        card.innerHTML = `
            <div class="entry-card-header">
                <span class="entry-date">${formatDate(entry.date)}</span>
                <span class="entry-words">${entry.wordCount.toLocaleString()} words</span>
            </div>
            ${tagsHtml ? `<div class="entry-tags">${tagsHtml}</div>` : ''}
            ${entry.note ? `<div class="entry-note">Note: ${esc(entry.note)}</div>` : ''}
            <p class="entry-preview">${esc(preview)}${entry.text.length > 220 ? '…' : ''}</p>
            <div class="entry-actions">
                <button class="btn btn-secondary btn-sm read-btn">Read full</button>
                <button class="btn btn-secondary btn-sm copy-btn">Copy</button>
            </div>
        `;

        card.querySelector('.read-btn').addEventListener('click', () => openModal(entry));
        card.querySelector('.copy-btn').addEventListener('click', e => quickCopy(entry, e.target));

        container.appendChild(card);
    });
}

// ── Full entry modal ────────────────────────────────────────────
function openModal(entry) {
    selectedEntry = entry;

    const tagsHtml = [
        ...entry.tags.characters.map(c => `<span class="chip chip-character">${esc(c)}</span>`),
        ...entry.tags.plotPoints.map(p => `<span class="chip chip-plot">${esc(p)}</span>`),
        ...entry.tags.keywords.map(k => `<span class="chip chip-keyword">${esc(k)}</span>`)
    ].join('');

    document.getElementById('modalDate').textContent = formatDate(entry.date);
    document.getElementById('modalTags').innerHTML   = tagsHtml;
    document.getElementById('modalNote').textContent = entry.note ? `Note: ${entry.note}` : '';
    document.getElementById('modalText').textContent = entry.text;
    document.getElementById('modalMeta').textContent =
        `${entry.wordCount.toLocaleString()} words · ${entry.sessionMinutes} min session`;
    document.getElementById('copyConfirm').classList.add('hidden');
    document.getElementById('entryModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('entryModal').style.display = 'none';
    selectedEntry = null;
}

function quickCopy(entry, btn) {
    navigator.clipboard.writeText(entry.text).then(() => {
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = original; }, 2000);
    });
}

// ── Event listeners ─────────────────────────────────────────────
function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', e => {
        filters.search = e.target.value;
        renderEntries();
    });

    document.getElementById('sortSelect').addEventListener('change', e => {
        filters.sort = e.target.value;
        renderEntries();
    });

    document.getElementById('dateFrom').addEventListener('change', e => {
        filters.dateFrom = e.target.value;
        renderEntries();
    });

    document.getElementById('dateTo').addEventListener('change', e => {
        filters.dateTo = e.target.value;
        renderEntries();
    });

    document.getElementById('clearFiltersBtn').addEventListener('click', () => {
        filters = { search: '', characters: [], plotPoints: [], dateFrom: '', dateTo: '', sort: 'newest' };
        document.getElementById('searchInput').value  = '';
        document.getElementById('sortSelect').value   = 'newest';
        document.getElementById('dateFrom').value     = '';
        document.getElementById('dateTo').value       = '';
        document.querySelectorAll('#charFilters input, #plotFilters input')
            .forEach(cb => { cb.checked = false; });
        renderEntries();
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
        const content  = exportAsText();
        const blob     = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url      = URL.createObjectURL(blob);
        const a        = document.createElement('a');
        a.href         = url;
        a.download     = `my-story-${getTodayDate()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    document.getElementById('closeModalBtn').addEventListener('click', closeModal);

    document.getElementById('entryModal').addEventListener('click', e => {
        if (e.target === document.getElementById('entryModal')) closeModal();
    });

    document.getElementById('copyEntryBtn').addEventListener('click', () => {
        if (!selectedEntry) return;
        navigator.clipboard.writeText(selectedEntry.text).then(() => {
            const confirm = document.getElementById('copyConfirm');
            confirm.classList.remove('hidden');
            setTimeout(() => confirm.classList.add('hidden'), 2000);
        });
    });
}

// ── Utility ─────────────────────────────────────────────────────
function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
