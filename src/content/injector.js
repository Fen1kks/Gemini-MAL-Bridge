const TRIGGER_KEYWORD = '#anime';
let contextInjected = false; 

let bridgeConfig = {
    mal_username: null,
    target_url: null,
    target_chat_ui_color: null,
    anime_list_watching: null,
    last_shadow_hash: null,
    anime_list_history: null,
    ready: false
};

console.log('Gemini-MAL Bridge: Injector started');
updateConfig();

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        updateConfig();
    }
});

function updateConfig() {
    chrome.storage.local.get(null, (result) => {
        bridgeConfig = { ...bridgeConfig, ...result, ready: true };
        applyUIHighlight();
    });
}

const HIGHLIGHT_STYLE_ID = 'gemini-mal-bridge-highlight';

function applyUIHighlight() {
    const existingStyle = document.getElementById(HIGHLIGHT_STYLE_ID);
    if (existingStyle) existingStyle.remove();

    const color = bridgeConfig.target_chat_ui_color;
    const targetUrl = bridgeConfig.target_url;

    if (!color || !targetUrl) return;

    const current = window.location.href.toLowerCase();
    const target = targetUrl.toLowerCase().replace(/\/$/, '');
    if (!current.startsWith(target)) return;

    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const chatIdMatch = targetUrl.match(/\/app\/([a-f0-9]+)/i);
    const chatId = chatIdMatch ? chatIdMatch[1] : null;

    const style = document.createElement('style');
    style.id = HIGHLIGHT_STYLE_ID;
    style.textContent = `
        /* Gemini-MAL Bridge: Active Channel Indicator */

        /* Gemini logo text - color */
        .bard-logo-container,
        .bard-logo-container * {
            color: ${color} !important;
            transition: color 0.3s !important;
        }

        /* Only the target conversation in sidebar - text color */
        ${chatId ? `
        a.conversation[href*="${chatId}"],
        a.conversation[href*="${chatId}"] * {
            color: ${color} !important;
            transition: color 0.3s !important;
        }
        ` : ''}

        /* Input area placeholder & text - color */
        .input-area-container .ql-editor,
        .input-area-container .ql-editor.ql-blank::before {
            color: ${color} !important;
            transition: color 0.3s !important;
        }

        /* Tools button text - color */
        .toolbox-drawer-button,
        .toolbox-drawer-button * {
            color: ${color} !important;
            transition: color 0.3s !important;
        }

        /* Trailing actions (Pro/Mic) - color */
        .trailing-actions-wrapper,
        .trailing-actions-wrapper * {
            color: ${color} !important;
            transition: color 0.3s !important;
        }

        /* Upload/Add (+) button - color */
        .upload-card-button,
        .upload-card-button * {
            color: ${color} !important;
            transition: color 0.3s !important;
        }

        /* Small floating indicator badge */
        body::after {
            content: '🔗 MAL Bridge';
            position: fixed;
            bottom: 12px;
            right: 12px;
            background: rgba(${r}, ${g}, ${b}, 0.15);
            border: 1px solid rgba(${r}, ${g}, ${b}, 0.4);
            color: ${color};
            font-size: 11px;
            font-weight: 600;
            padding: 4px 10px;
            border-radius: 100px;
            z-index: 99999;
            pointer-events: none;
            font-family: 'Google Sans', 'Roboto', sans-serif;
            backdrop-filter: blur(8px);
            animation: gmb-fade-in 0.5s ease;
        }

        @keyframes gmb-fade-in {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;

    document.head.appendChild(style);
    console.log(`Gemini-MAL Bridge: UI highlight applied (${color})`);
}

let lastUrl = location.href;
const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        applyUIHighlight();
    }
});
urlObserver.observe(document.body, { childList: true, subtree: true });

async function getStoredData() {
    if (!chrome.runtime?.id) {
        console.warn('Gemini-MAL Bridge: Extension context invalidated. Please reload the page.');
        return null; 
    }

    return new Promise((resolve) => {
        try {
            chrome.storage.local.get(null, (result) => {
                if (chrome.runtime.lastError) {
                    console.warn('Gemini-MAL Bridge: Storage error:', chrome.runtime.lastError);
                    resolve(null);
                } else {
                    resolve(result);
                }
            });
        } catch (e) {
            console.warn('Gemini-MAL Bridge: Storage access failed:', e);
            resolve(null);
        }
    });
}

document.addEventListener('keydown', async (e) => {
    
    if (!e.isTrusted) return;

    if (e.key !== 'Enter' || e.shiftKey) return;

    if (!bridgeConfig.ready) return;

    if (bridgeConfig.target_url) {
        const current = window.location.href.toLowerCase();
        const target = bridgeConfig.target_url.toLowerCase().replace(/\/$/, '');
        if (!current.startsWith(target)) return;
    } else {
        return; 
    }

    const target = e.target.closest('div[contenteditable="true"], textarea, input');
    if (!target) return;

    if (!bridgeConfig.anime_list_watching) return;

    const userMessage = target.innerText || target.value || '';
    if (!userMessage.trim()) return;

    const planMatch = userMessage.match(/#plan2w(\d*)/i);
    const forceAnime = userMessage.match(/#anime/i);

    if (planMatch) {
         e.preventDefault();
         e.stopPropagation();
         
         const limit = planMatch[1] ? parseInt(planMatch[1], 10) : 50;
         console.log(`Gemini-MAL Bridge: Command #plan2w detected (Limit: ${limit})`);

         chrome.storage.local.get(['anime_list_plan_to_watch'], (res) => {
             const ptw = res.anime_list_plan_to_watch || [];
             const pref = bridgeConfig.preferred_language || 'auto';
             const userLang = (pref === 'auto') ? (navigator.language || 'en') : pref;
             
             const shadowPrompt = generatePlanToWatchPrompt(ptw, limit, userLang);
             
             const cleanMessage = userMessage.replace(/#plan2w(\d*)/i, '').trim() || "What do you think about my Plan to Watch list?";
             
             handleEnterLogic(target, cleanMessage, shadowPrompt, null);
         });
         return;
    }

    if (forceAnime) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Gemini-MAL Bridge: Command #anime detected. Forcing full context.');
        
        const pref = bridgeConfig.preferred_language || 'auto';
        const userLang = (pref === 'auto') ? (navigator.language || 'en') : pref;
        
        const shadowPrompt = generateShadowPrompt(bridgeConfig, userLang);
        
        const cleanMessage = userMessage.replace(/#anime/i, '').trim() || "What do you think about my anime profile?";
        
        handleEnterLogic(target, cleanMessage, shadowPrompt, null);
        return;
    }

    const pendingDiff = bridgeConfig.pending_changes;
    if (!pendingDiff || !pendingDiff.has_changes) {
        console.log('Gemini-MAL Bridge: No pending changes. Silent mode active.');
        return;
    }

    console.log('Gemini-MAL Bridge: Pending changes detected!', pendingDiff);
    e.preventDefault(); 
    e.stopImmediatePropagation(); 
    e.stopPropagation();

    const diffSummary = pendingDiff.summary_text;
    
    const pref = bridgeConfig.preferred_language || 'auto';
    const userLang = (pref === 'auto') ? (navigator.language || 'en') : pref;
    const isTurkish = userLang.startsWith('tr');

    const shadowPrompt = `
--- 🛡️ HIDDEN SYSTEM CONTEXT (SHADOW MODE) ---
[System Notification: User updated MyAnimeList data.]

${diffSummary}

⚙️ **INSTRUCTIONS:**
1. Update your memory with these changes.
2. This is real data, take precedence over old memory.
${isTurkish ? 
'- **OUTPUT LANGUAGE:** TURKISH (Türkçe). Act like a Turkish Nakama.' : 
'- **OUTPUT LANGUAGE:** ENGLISH. Act like an English Nakama.'}
--- END OF CONTEXT ---
`;
    
    console.log('Gemini-MAL Bridge: Injecting Shadow Prompt:\n', shadowPrompt);

    handleEnterLogic(target, userMessage, shadowPrompt, pendingDiff);

}, { capture: true });

async function handleEnterLogic(target, userMessage, shadowPrompt, pendingDiff) {
    try {
        const finalPayload = userMessage + "\n\n" + shadowPrompt;

        target.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, finalPayload);
        if (pendingDiff) {
            const data = await getStoredData();
            if (data && data.latest_fetch) {
                chrome.storage.local.set({ 
                    last_snapshot: data.latest_fetch,
                    last_snapshot_date: new Date().toISOString(),
                    pending_changes: null
                });
                console.log('Gemini-MAL Bridge: Snapshot updated, queue cleared.');
            }
        }
        
        flashSuccess(target);

        setTimeout(() => {
            triggerSend(target);
        }, 300);

    } catch (err) {
        console.error('Gemini-MAL Bridge: Error in logic:', err);
        triggerSend(target);
    }
}

function triggerSend(target) {
    const options = {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window
    };
    
    target.dispatchEvent(new KeyboardEvent('keydown', options));
    target.dispatchEvent(new KeyboardEvent('keypress', options));
    target.dispatchEvent(new KeyboardEvent('keyup', options));

    setTimeout(() => {
        if (!target.innerText || target.innerText.trim() === '') {
            console.log('Gemini-MAL Bridge: Input appears empty, assuming Enter worked. Skipping fallback click.');
            return;
        }

        const sendButton = document.querySelector('button[aria-label*="Send"], button[aria-label*="Gönder"], div[role="button"][aria-label*="Gönder"], div[role="button"][aria-label*="Send"]');
        
        if (sendButton) {
            const label = (sendButton.ariaLabel || '').toLowerCase();
            if (label.includes('stop') || label.includes('durdur')) {
                console.log('Gemini-MAL Bridge: Detected Stop button. Aborting click.');
                return;
            }

            console.log('Gemini-MAL Bridge: Enter didn\'t clear input. Asking to click Send...');
            sendButton.click();
        }
    }, 300); 
}

function flashSuccess(target) {
    const originalBorder = target.style.border;
    target.style.transition = "box-shadow 0.3s, border-color 0.3s";
    target.style.borderColor = "#4caf50";
    target.style.boxShadow = "0 0 10px rgba(76, 175, 80, 0.5)";
    setTimeout(() => {
        target.style.borderColor = ""; 
        target.style.boxShadow = "";
        if (originalBorder) target.style.border = originalBorder;
    }, 1000);
}

function cleanTitle(title) {
    return title.split(':')[0].split(' Season')[0].split(' Part')[0].trim();
}

function generateShadowPrompt(data, language = 'tr') {
    const watching = data.anime_list_watching || [];
    const history = data.anime_list_history || [];
    const favorites = data.anime_list_favorites || [];

    let languageInstruction = "";
    if (language.startsWith('tr')) {
        languageInstruction = `
        - **OUTPUT LANGUAGE:** TURKISH (Türkçe).
        - **TONE:** Use authentic Turkish anime community slang (e.g., "Efsane", "Çöp", "Hype", "Duygu sömürüsü").
        - **STYLE:** Act like a Turkish "Nakama" (Close friend).
        `;
    } else {
        languageInstruction = `
        - **OUTPUT LANGUAGE:** ENGLISH.
        - **TONE:** Use casual anime community slang (e.g., "Goated", "Trash", "Hype", "Feels").
        - **STYLE:** Act like an English-speaking "Nakama" (Close friend).
        `;
    }

    const listText = watching.map(item => {
        const title = item.title;
        const watched = item.episodes_watched;
        const score = item.score > 0 ? `(Score: ${item.score})` : "(Score: -)";
        return `- ${title}: Ep ${watched} ${score}`;
    }).join("\n");

    const favText = favorites.map(item => {
        const title = item.node ? item.node.title : (item.title || "Unknown"); 
        const score = item.list_status ? item.list_status.score : (item.score || "?");
        return `- ${title} (Score: ${score} ⭐)`;
    }).join("\n");

    const seenFranchises = new Set();
    const historyText = history.reduce((acc, item) => {
        const simpleTitle = cleanTitle(item.title);
        if (seenFranchises.has(simpleTitle)) return acc;
        seenFranchises.add(simpleTitle);
        
        const dateStr = item.updated_at_formatted || "??.??.????";
        const scoreStr = item.score > 0 ? ` (Score: ${item.score})` : '';
        acc.push(`- ${item.title} [${dateStr}]: ${item.status}${scoreStr}`);
        return acc;
    }, []).slice(0, 15).join("\n");

    return `
--- 🛡️ HIDDEN SYSTEM CONTEXT (SHADOW MODE) ---
[System Notification: Live MyAnimeList Data Injected]

👤 **USER PROFILE:**

▶️ **CURRENTLY WATCHING:**
${listText}

🏆 **TASTE REFERENCES (Top Rated):**
${favText}
*(Note: Use these to understand the user's taste palette.)*

🕒 **RECENT ACTIVITY:**
${historyText}

⚙️ **MANDATORY INSTRUCTIONS:**
1. **Context Integration:** Merge this data with your existing memory. This is the single source of truth.
2. **Memory Update:** If there are conflicts with previous data (e.g., episode counts), **overwrite** with this new data.
3. **Context Preservation:** Do NOT delete personal details or chat history the user shared previously. Only update anime data.
4. **Spoiler Shield:** NEVER discuss events beyond the "Episodes Watched" count.
${languageInstruction}

--- END OF CONTEXT (Please reply to the user's message above) ---
`;
}

function generatePlanToWatchPrompt(ptwList, limit = 50, language = 'tr') {
    if (!ptwList || ptwList.length === 0) return "No planned anime found.";

    let languageInstruction = "";
    if (language.startsWith('tr')) {
        languageInstruction = `
        - **OUTPUT LANGUAGE:** TURKISH (Türkçe).
        - **TONE:** Enthusiastic, encouraging.
        - **STYLE:** Act like a Turkish "Nakama".
        `;
    } else {
        languageInstruction = `
        - **OUTPUT LANGUAGE:** ENGLISH.
        - **TONE:** Enthusiastic, encouraging.
        - **STYLE:** Act like an English-speaking "Nakama".
        `;
    }

    const sorted = [...ptwList].sort((a, b) => {
        const meanA = a.node?.mean || 0;
        const meanB = b.node?.mean || 0;
        return meanB - meanA;
    });

    const sliced = sorted.slice(0, limit);

    const listText = sliced.map(item => {
        const node = item.node || {};
        const score = node.mean ? `(Score: ${node.mean})` : "";
        const type = node.media_type ? `[${node.media_type.toUpperCase()}]` : "";
        return `- ${node.title} ${type} ${score}`;
    }).join("\n");

    return `
--- 📜 PLANNED ANIME (PLAN TO WATCH) ---
[SYSTEM NOTIFICATION: User shared their plan to watch list.]
(Top ${sliced.length} highest rated out of ${ptwList.length} total)

${listText}

⚙️ **INSTRUCTIONS:**
This list contains series the user has *not watched yet* but is interested in.
1. If you recommend something from this list, say "It's already in your plan, start it now!".
2. Analyze the user's taste based on genres here.
${languageInstruction}
--- END OF LIST ---
`;
}
