// Combat View Logic - Read Only Sync

let currentState = null;

async function pollState() {
    try {
        const response = await fetch('/api/combat/state');
        const data = await response.json();

        if (data.success && data.state) {
            updateView(data.state);
        }
    } catch (e) {
        console.error('Polling error:', e);
    }

    // Poll every 1 second
    setTimeout(pollState, 1000);
}

function updateView(state) {
    if (!state.map_filename) {
        document.getElementById('tacticalMapContainer').style.display = 'none';
        document.getElementById('waitMessage').style.display = 'block';
        return;
    }

    document.getElementById('waitMessage').style.display = 'none';
    const container = document.getElementById('tacticalMapContainer');
    const img = document.getElementById('tacticalMapImage');

    // Update Image only if changed to avoid flicker
    if (!currentState || currentState.map_filename !== state.map_filename) {
        // Handle base64 (local unsaved map) vs server path
        let src = state.map_filename;
        if (src && src.startsWith('data:')) {
            img.src = src;
        } else if (src && (src.startsWith('http') || src.startsWith('/'))) {
            img.src = src; F
        } else {
            img.src = `/static/uploads/tactical_maps/${src}`;
        }

        img.onload = () => container.style.display = 'flex';
    }

    // Update Grid inputs for compatibility with styling if needed
    document.getElementById('mapRows').value = state.rows;
    document.getElementById('mapCols').value = state.cols;

    // Update Grid Visuals
    const grid = document.getElementById('tacticalMapGrid');
    if (state.rows && state.cols) {
        grid.style.backgroundImage = `
            linear-gradient(to right, rgba(255, 255, 255, 0.5) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.5) 1px, transparent 1px)
        `;
        grid.style.backgroundSize = `calc(100% / ${state.cols}) calc(100% / ${state.rows})`;
        grid.style.border = '1px solid rgba(255, 255, 255, 0.5)';
        grid.style.display = 'block';
    }

    renderTokens(state.tokens, state.rows, state.cols, state.activeCombatantId);
    renderArrows(state.arrows, state.tokens, state.rows, state.cols);

    // Popup Image Logic
    const popupModal = document.getElementById('imagePopupModal');
    const popupImg = document.getElementById('popupImageElement');

    if (state.popup_image) {
        // Only update src if changed
        const newSrc = `/static/uploads/badges/${state.popup_image}`;
        if (!popupImg.src.endsWith(newSrc)) {
            popupImg.src = newSrc;
        }
        popupModal.style.display = 'flex';
    } else {
        popupModal.style.display = 'none';
        popupImg.src = '';
    }

    // Audio Sync
    syncAudio(state.audio_tracks || [], state.global_volume !== undefined ? state.global_volume : 0.5);

    currentState = state;
}

let activeAudioPlayers = {}; // Map filename -> Audio object
let audioEnabled = false;

function initAudio() {
    audioEnabled = true;
    document.getElementById('enableAudioResults').style.display = 'none';
    // Trigger a silent play to unlock audio context if needed, or just set flag
    // For HTML5 Audio, simple interaction is usually enough for future plays
    // Retry syncing immediately
    if (currentState && currentState.audio_tracks) {
        syncAudio(currentState.audio_tracks);
    }
}

function syncAudio(serverTracks, globalVolume = 0.5) {
    if (!audioEnabled) return;

    // Normalize tracks to objects (handle legacy strings if any)
    const normalizedTracks = serverTracks.map(t => {
        if (typeof t === 'string') return { filename: t, loop: true };
        return t;
    });

    const currentFilenames = normalizedTracks.map(t => t.filename);

    // 1. Play or Update tracks
    normalizedTracks.forEach(track => {
        const filename = track.filename;
        const shouldLoop = track.loop;

        if (!activeAudioPlayers[filename]) {
            const audio = new Audio(`/static/uploads/sounds/${filename}`);
            audio.loop = shouldLoop;
            audio.volume = globalVolume;
            audio.play().catch(e => console.error("Autoplay blocked:", e));
            activeAudioPlayers[filename] = audio;
        } else {
            const audio = activeAudioPlayers[filename];
            // Update Volume
            audio.volume = globalVolume;
            // Update Loop State
            if (audio.loop !== shouldLoop) {
                audio.loop = shouldLoop;
            }
        }
    });

    // 2. Stop removed tracks
    for (const [filename, audio] of Object.entries(activeAudioPlayers)) {
        if (!currentFilenames.includes(filename)) {
            audio.pause();
            audio.currentTime = 0;
            delete activeAudioPlayers[filename];
        }
    }
}

function renderTokens(tokens, rows, cols, activeId) {
    const container = document.getElementById('mapTokensContainer');
    container.innerHTML = '';

    tokens.forEach(c => {
        const token = document.createElement('div');
        token.className = `map-token ${c.isPG ? 'is-pg' : 'is-npc'}`;
        if (activeId && c.instanceId === activeId) {
            token.classList.add('active');
        }
        if (c.isDead) { // Add dead class
            token.classList.add('dead');
            token.style.opacity = '0.7';
            token.style.borderColor = '#000';
        }

        if (c.image_filename) {
            token.style.backgroundImage = `url('/static/uploads/badges/${c.image_filename}')`;
        } else {
            token.innerText = c.name.substring(0, 2);
            token.style.display = 'flex';
            token.style.alignItems = 'center';
            token.style.justifyContent = 'center';
            token.style.color = '#fff';
            token.style.fontWeight = 'bold';
            token.style.fontSize = '12px';
        }

        // Size
        let sizeW = 1, sizeH = 1;
        if (c.size) {
            const parts = c.size.toLowerCase().split('x');
            if (parts.length === 2) {
                sizeW = parseInt(parts[0]) || 1;
                sizeH = parseInt(parts[1]) || 1;
            }
        }

        token.style.width = `calc((100% / ${cols}) * ${sizeW})`;
        token.style.height = `calc((100% / ${rows}) * ${sizeH})`;
        token.style.borderRadius = (sizeW === sizeH) ? '50%' : '15%';

        token.style.left = `${c.x}%`;
        token.style.top = `${c.y}%`;

        // No drag events in view mode

        // Add number badge if present in name
        const nameMatch = c.name.match(/ (\d+)$/);
        if (nameMatch) {
            const numBadge = document.createElement('div');
            numBadge.innerText = nameMatch[1];
            numBadge.style.position = 'absolute';
            numBadge.style.bottom = '-2px';
            numBadge.style.right = '-2px';
            numBadge.style.background = '#d4af37';
            numBadge.style.color = '#000';
            numBadge.style.fontSize = '10px';
            numBadge.style.fontWeight = 'bold';
            numBadge.style.padding = '0 3px';
            numBadge.style.borderRadius = '3px';
            numBadge.style.border = '1px solid #000';
            numBadge.style.zIndex = '10';
            token.appendChild(numBadge);
        }

        container.appendChild(token);
    });
}

function renderArrows(arrowsData, tokens, rows, cols) {
    const svg = document.getElementById('mapArrowsLayer');
    svg.innerHTML = '';

    // Add Marker Defs
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
        <marker id="arrowhead" markerWidth="10" markerHeight="7" 
        refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#ff0000" />
        </marker>
    `;
    svg.appendChild(defs);

    // We recalculate arrows based on tokens targeting

    tokens.forEach(source => {
        if (source.targetId) {
            const target = tokens.find(t => t.instanceId === source.targetId);
            if (target) {
                // Calculate Centers
                let sW = 1, sH = 1;
                if (source.size) {
                    const p = source.size.toLowerCase().split('x');
                    if (p.length === 2) { sW = parseInt(p[0]); sH = parseInt(p[1]); }
                }

                let tW = 1, tH = 1;
                if (target.size) {
                    const p = target.size.toLowerCase().split('x');
                    if (p.length === 2) { tW = parseInt(p[0]); tH = parseInt(p[1]); }
                }

                const cellW = 100 / cols;
                const cellH = 100 / rows;

                const x1 = source.x + (sW * cellW / 2);
                const y1 = source.y + (sH * cellH / 2);
                const x2 = target.x + (tW * cellW / 2);
                const y2 = target.y + (tH * cellH / 2);

                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", x1 + "%");
                line.setAttribute("y1", y1 + "%");
                line.setAttribute("x2", x2 + "%");
                line.setAttribute("y2", y2 + "%");
                line.setAttribute("stroke", "rgba(255, 0, 0, 0.6)");
                line.setAttribute("stroke-width", "2");
                line.setAttribute("marker-end", "url(#arrowhead)");

                svg.appendChild(line);
            }
        }
    });
}

// Start polling
pollState();
