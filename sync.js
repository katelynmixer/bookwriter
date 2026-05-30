let syncDebounceTimer = null;

// Push local data up to Firestore (called after every save)
// Debounced so rapid saves don't spam Firestore
function syncToFirestore() {
    if (window.location.protocol === 'file:') return;
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(async () => {
        updateSyncStatus('syncing');
        try {
            await FIRESTORE_REF.set(getData());
            updateSyncStatus('synced');
        } catch (e) {
            console.warn('Could not sync to Firestore:', e);
            updateSyncStatus('offline');
        }
    }, 1000);
}

// Pull data down from Firestore and merge with local data
// Called on page load so the device always has the latest entries
async function syncFromFirestore() {
    if (window.location.protocol === 'file:') {
        updateSyncStatus('offline');
        return false;
    }
    updateSyncStatus('syncing');
    try {
        const doc = await FIRESTORE_REF.get();

        if (doc.exists) {
            const remote = doc.data();
            const local  = getData();

            // Merge entries: keep all unique entries from both sides (safe if offline writes happened)
            const merged = [...local.entries];
            remote.entries.forEach(remoteEntry => {
                if (!merged.find(e => e.id === remoteEntry.id)) {
                    merged.push(remoteEntry);
                }
            });
            merged.sort((a, b) => a.date.localeCompare(b.date));

            const mergedData = {
                entries:    merged,
                characters: [...new Set([...local.characters, ...remote.characters])],
                plotPoints: [...new Set([...local.plotPoints, ...remote.plotPoints])],
                settings:   remote.settings || local.settings
            };

            // Save merged data locally
            localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedData));

            // If we found local entries that weren't in Firestore, push the merge back up
            if (merged.length > remote.entries.length) {
                await FIRESTORE_REF.set(mergedData);
            }
        } else {
            // First time syncing from a new device — push local data up to Firestore
            const local = getData();
            if (local.entries.length > 0) {
                await FIRESTORE_REF.set(local);
            }
        }

        updateSyncStatus('synced');
        return true;
    } catch (e) {
        console.warn('Could not reach Firestore:', e);
        updateSyncStatus('offline');
        return false;
    }
}

function updateSyncStatus(status) {
    const el = document.getElementById('syncStatus');
    if (!el) return;

    const states = {
        syncing: { label: '● Syncing…', color: '#c49a52' },
        synced:  { label: '● Synced',   color: '#4a7c59' },
        offline: { label: '● Offline',  color: '#9b8f87' }
    };

    const s = states[status] || states.offline;
    el.textContent = s.label;
    el.style.color  = s.color;
}
