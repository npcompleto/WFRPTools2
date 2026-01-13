// Sound Widget Logic

const soundWidgetTemplate = `
<div id="sound-widget" style="position: fixed; bottom: 20px; right: 160px; z-index: 9998; font-family: 'Cinzel', serif;">
    <button id="sound-widget-toggle" style="
        background: #2c3e50; 
        color: #d4af37; 
        border: 2px solid #d4af37; 
        border-radius: 50%; 
        width: 50px; 
        height: 50px; 
        cursor: pointer; 
        font-size: 20px;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
    ">🎵</button>

    <div id="sound-widget-panel" style="
        display: none; 
        position: absolute; 
        bottom: 60px; 
        right: 0; 
        width: 300px; 
        background: rgba(10, 10, 10, 0.95); 
        border: 2px solid #d4af37; 
        border-radius: 8px; 
        padding: 10px; 
        color: #eee;
        box-shadow: 0 0 15px rgba(0,0,0,0.8);
        max-height: 500px;
        overflow-y: auto;
    ">
        <h4 style="margin: 0 0 10px 0; color: #d4af37; border-bottom: 1px solid #444; padding-bottom: 5px;">Suoni & Musica</h4>
        
        <div style="margin-bottom: 10px; display: flex; gap: 5px; flex-direction: column;">
            <input type="text" id="sound-search-input" placeholder="Cerca titolo..." style="
                background: rgba(255,255,255,0.1); 
                border: 1px solid #555; 
                color: #fff; 
                padding: 5px; 
                border-radius: 4px;
                font-family: inherit;
            ">
            <select id="sound-category-filter" style="
                background: rgba(255,255,255,0.1); 
                border: 1px solid #555; 
                color: #666; 
                padding: 5px; 
                border-radius: 4px;
                font-family: inherit;
            ">
                <option value="">Tutte le categorie</option>
            </select>
        </div>

        <div style="margin-bottom: 10px; border-top: 1px solid #444; padding-top: 10px;">
            <label style="font-size: 0.9em; color: #aaa; display: block; margin-bottom: 5px;" for="global-volume-slider">Volume Master</label>
            <input type="range" id="global-volume-slider" min="0" max="1" step="0.1" value="0.5" style="width: 100%;">
        </div>
        
        <div style="text-align: right;">
            <button id="stop-all-sounds" style="background: #c0392b; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Stop All</button>
        </div>

        <div id="sound-list" style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 15px;">
            <!-- Sounds will be loaded here -->
            <div style="text-align: center; color: #777;">Caricamento...</div>
        </div>
        
        
    </div>
</div>
`;

// Inject Styles and HTML
document.body.insertAdjacentHTML('beforeend', soundWidgetTemplate);

// Logic
let activeSounds = new Set();
let allSoundsData = [];
let globalVolume = 0.5;

document.getElementById('sound-widget-toggle').addEventListener('click', () => {
    const panel = document.getElementById('sound-widget-panel');
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible && allSoundsData.length === 0) {
        loadSoundsWidgetData();
    }
});

// Filters Events
document.getElementById('sound-search-input').addEventListener('input', applyFilters);
document.getElementById('sound-category-filter').addEventListener('change', applyFilters);

document.body.addEventListener('input', (e) => {
    if (e.target.id === 'global-volume-slider') {
        globalVolume = parseFloat(e.target.value);
        syncAudioState();
    }
});

async function loadSoundsWidgetData() {
    try {
        const response = await fetch('/api/sounds');
        const data = await response.json();
        if (data.success) {
            allSoundsData = data.sounds;
            populateCategoryFilter(allSoundsData);
            renderSoundWidgetList(allSoundsData);
        }
    } catch (e) {
        console.error('Error loading sounds:', e);
    }
}

function populateCategoryFilter(sounds) {
    const filter = document.getElementById('sound-category-filter');
    const categories = new Set(sounds.map(s => s.category || 'Generico'));
    const currentVal = filter.value;

    filter.innerHTML = '<option value="">Tutte le categorie</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.innerText = cat;
        filter.appendChild(option);
    });

    if (currentVal) filter.value = currentVal;
}

function applyFilters() {
    const searchText = document.getElementById('sound-search-input').value.toLowerCase();
    const categoryVal = document.getElementById('sound-category-filter').value;

    const filtered = allSoundsData.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchText);
        const matchesCategory = categoryVal === "" || (s.category || 'Generico') === categoryVal;
        return matchesSearch && matchesCategory;
    });

    renderSoundWidgetList(filtered);
}

function renderSoundWidgetList(sounds) {
    const list = document.getElementById('sound-list');
    list.innerHTML = '';

    // Group by category
    const grouped = {};
    sounds.forEach(s => {
        if (!grouped[s.category]) grouped[s.category] = [];
        grouped[s.category].push(s);
    });

    for (const [category, items] of Object.entries(grouped)) {
        const catHeader = document.createElement('div');
        catHeader.style.fontWeight = 'bold';
        catHeader.style.color = '#aaa';
        catHeader.style.marginTop = '10px';
        catHeader.style.fontSize = '0.9em';
        catHeader.innerText = category || 'Generico';
        list.appendChild(catHeader);

        items.forEach(sound => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.padding = '4px';
            row.style.background = 'rgba(255,255,255,0.05)';
            row.style.borderRadius = '4px';

            const nameSpan = document.createElement('span');
            nameSpan.innerText = sound.name;
            nameSpan.style.fontSize = '0.9em';

            const playBtn = document.createElement('button');
            playBtn.innerText = '▶';
            playBtn.style.background = 'none';
            playBtn.style.border = '1px solid #555';
            playBtn.style.color = '#eee';
            playBtn.style.cursor = 'pointer';
            playBtn.style.borderRadius = '50%';
            playBtn.style.width = '24px';
            playBtn.style.height = '24px';
            playBtn.style.fontSize = '12px';
            playBtn.style.display = 'flex';
            playBtn.style.alignItems = 'center';
            playBtn.style.justifyContent = 'center';

            playBtn.onclick = () => toggleSound(sound.filename, playBtn);

            if (activeSounds.has(sound.filename)) {
                playBtn.innerText = '⏹';
                playBtn.style.borderColor = '#e74c3c';
                playBtn.style.color = '#e74c3c';
            }

            row.appendChild(nameSpan);
            row.appendChild(playBtn);
            list.appendChild(row);
        });
    }
}

function toggleSound(filename, btn) {
    if (activeSounds.has(filename)) {
        activeSounds.delete(filename);
        btn.innerText = '▶';
        btn.style.borderColor = '#555';
        btn.style.color = '#eee';
    } else {
        activeSounds.add(filename);
        btn.innerText = '⏹';
        btn.style.borderColor = '#2ecc71';
        btn.style.color = '#2ecc71';
    }
    syncAudioState();
}

document.getElementById('stop-all-sounds').addEventListener('click', () => {
    activeSounds.clear();
    const btns = document.querySelectorAll('#sound-list button');
    btns.forEach(btn => {
        btn.innerText = '▶';
        btn.style.borderColor = '#555';
        btn.style.color = '#eee';
    });
    syncAudioState();
});

function syncAudioState() {
    fetch('/api/combat/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tracks: Array.from(activeSounds),
            volume: globalVolume
        })
    });
}
