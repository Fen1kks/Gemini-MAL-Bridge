import { saveUserData, getUserData } from '../utils/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
    const usernameInput = document.getElementById('username');
    const clientIdInput = document.getElementById('clientId');
    const targetUrlInput = document.getElementById('targetUrl');
    const saveBtn = document.getElementById('saveBtn');
    const statusDiv = document.getElementById('status');
    const diffContainer = document.getElementById('diffContainer');
    const diffList = document.getElementById('diffList');
    const toggleClientIdBtn = document.getElementById('toggleClientId');
    const languageSelect = document.getElementById('languageSelect');
    const uiColorText = document.getElementById('uiColorText');
    const uiColorPicker = document.getElementById('uiColorPicker');
    const uiColorClear = document.getElementById('uiColorClear');

    if (toggleClientIdBtn && clientIdInput) {
        toggleClientIdBtn.addEventListener('click', () => {
            const currentType = clientIdInput.getAttribute('type');
            if (currentType === 'password') {
                clientIdInput.setAttribute('type', 'text');
                toggleClientIdBtn.textContent = '🔒';
                toggleClientIdBtn.title = "Gizle";
            } else {
                clientIdInput.setAttribute('type', 'password');
                toggleClientIdBtn.textContent = '👁️';
                toggleClientIdBtn.title = "Göster";
            }
        });
    }

    if (uiColorText && uiColorPicker) {
        uiColorPicker.addEventListener('input', () => {
            uiColorText.value = uiColorPicker.value;
        });

        uiColorText.addEventListener('input', () => {
            const val = uiColorText.value.trim();
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                uiColorPicker.value = val;
            }
        });

        uiColorClear.addEventListener('click', () => {
            uiColorText.value = '';
            uiColorPicker.value = '#4caf50';
        });
    }

    const savedData = await getUserData(['mal_username', 'mal_client_id', 'target_url', 'preferred_language', 'theme', 'pending_changes', 'last_snapshot_date', 'target_chat_ui_color']);
    
    if (savedData.mal_username) usernameInput.value = savedData.mal_username;
    if (savedData.mal_client_id) clientIdInput.value = savedData.mal_client_id;
    if (savedData.target_url) targetUrlInput.value = savedData.target_url;
    if (savedData.preferred_language) languageSelect.value = savedData.preferred_language;
    if (savedData.target_chat_ui_color) {
        uiColorText.value = savedData.target_chat_ui_color;
        if (/^#[0-9A-Fa-f]{6}$/.test(savedData.target_chat_ui_color)) {
            uiColorPicker.value = savedData.target_chat_ui_color;
        }
    }
    
    updateUI(savedData);

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            getUserData(['pending_changes', 'preferred_language']).then(updateUI);
        }
    });

    saveBtn.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        const clientId = clientIdInput.value.trim();
        const targetUrl = targetUrlInput.value.trim();
        const language = languageSelect.value;
        const uiColor = uiColorText.value.trim();

        if (!username || !clientId) {
            showStatus('Please enter both Client ID and Username.', 'error');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Syncing...';

        try {
            await saveUserData({
                mal_username: username,
                mal_client_id: clientId,
                target_url: targetUrl,
                preferred_language: language,
                target_chat_ui_color: uiColor || null
            });
            
            const { fetchUserAnimeHistory, fetchUserFavorites, fetchUserAnimeList } = await import('../utils/api.js');
            const { normalizeAnimeData } = await import('../utils/normalizer.js');
            const { calculateDiff } = await import('../utils/diff_engine.js');

            const history = await fetchUserAnimeHistory(username, clientId);
            const favorites = await fetchUserFavorites(username, clientId);
            const watchingList = await fetchUserAnimeList(username, 'watching', clientId);
            const normalized = normalizeAnimeData([], history);
            
            const prevData = await getUserData(['last_snapshot', 'last_snapshot_date']);
            const lastSnapshot = prevData.last_snapshot || [];
            let lastSnapshotDate = prevData.last_snapshot_date;

            if (!lastSnapshotDate && lastSnapshot.length > 0) {
                lastSnapshotDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            }

            const diff = calculateDiff(lastSnapshot, normalized.history, lastSnapshotDate);

            if (diff.has_changes) {
                await saveUserData({
                    pending_changes: diff,
                    last_synced: new Date().toISOString(),
                    latest_fetch: normalized.history,
                    anime_list_favorites: favorites,
                    anime_list_watching: watchingList
                });
                showStatus('Changes Detected!', 'success');
            } else {
                if (lastSnapshot.length === 0) {
                     await saveUserData({
                        last_snapshot: normalized.history,
                        latest_fetch: normalized.history,
                        last_snapshot_date: new Date().toISOString(),
                        last_synced: new Date().toISOString()
                    });
                    showStatus('Initialized (No Diff).', 'success');
                } else {
                    showStatus('Synced (No New Changes).', 'info');
                }
            }

        } catch (error) {
            console.error(error);
            showStatus('Error: ' + error.message, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save & Sync';
        }
    });

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = 'status ' + type;
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.textContent = '';
                statusDiv.className = 'status';
            }, 3000);
        }
    }

    function updateUI(data) {
        if (data.pending_changes && data.pending_changes.has_changes) {
            diffContainer.style.display = 'block';
            diffList.innerHTML = '';
            
            const report = data.pending_changes;
            const lang = data.preferred_language || 'en';
            const isTr = lang.startsWith('tr');

            const t = {
                completed: isTr ? 'başarıyla tamamlandı!' : 'successfully completed!',
                watching: isTr ? 'izlenmeye başlandı.' : 'started watching.',
                plan_to_watch: isTr ? 'izlenecekler listesine eklendi.' : 'added to plan to watch.',
                added: isTr ? 'listeye eklendi' : 'added to list',
                episode: isTr ? 'Bölüm' : 'Ep',
                score: isTr ? 'Puan' : 'Score',
                status: isTr ? 'Durum' : 'Status',
                metadata: isTr ? 'Bilgiler güncellendi' : 'Metadata updated'
            };
            
            report.new_entries.forEach(item => {
                const li = document.createElement('li');
                if (item.status === 'completed') {
                     li.innerHTML = `🎉 <b>${item.title}</b> ${t.completed}`;
                } else if (item.status === 'watching') {
                     li.innerHTML = `▶️ <b>${item.title}</b> ${t.watching}`;
                } else if (item.status === 'plan_to_watch') {
                     li.innerHTML = `📑 <b>${item.title}</b> ${t.plan_to_watch}`;
                } else {
                     li.innerHTML = `🆕 <b>${item.title}</b> ${t.added} (${item.status}).`;
                }
                diffList.appendChild(li);
            });

            report.updates.forEach(u => {
                const li = document.createElement('li');
                const anime = u.anime;
                const changeParts = [];
                let statusChangedToCompleted = false;

                u.changes.forEach(c => {
                    if (c.field === 'episodes_watched') {
                        changeParts.push(`${t.episode}: ${c.old} &rarr; <b>${c.new}</b>`);
                    } else if (c.field === 'score') {
                         const oldScore = c.old === 0 ? '-' : c.old;
                         const newScore = c.new === 0 ? '-' : c.new;
                        changeParts.push(`${t.score}: ${oldScore} &rarr; <b>${newScore}</b>`);
                    } else if (c.field === 'status') {
                        if (c.new === 'completed') {
                            statusChangedToCompleted = true;
                        }
                        changeParts.push(`${t.status}: ${c.old} &rarr; <b>${c.new}</b>`);
                    } else if (c.field === 'metadata') {
                        changeParts.push(t.metadata);
                    }
                });

                if (statusChangedToCompleted) {
                    li.innerHTML = `🎉 <b>${anime.title}</b> ${t.completed} <br><small>(${changeParts.join(', ')})</small>`;
                } else {
                    li.innerHTML = `📝 <b>${anime.title}</b>: ${changeParts.join(', ')}`;
                }

                diffList.appendChild(li);
            });

            chrome.action.setBadgeText({ text: '!' });
        } else {
            diffContainer.style.display = 'none';
            chrome.action.setBadgeText({ text: '' });
        }
    }
});
