document.addEventListener('DOMContentLoaded', () => {
    // Inject Styles needed for the widget
    const style = document.createElement('style');
    style.innerHTML = `
        #xp-widget {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        #xp-widget-btn {
            background-color: #d4a017; /* Gold/Amber */
            color: white;
            border: none;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
        }
        #xp-widget-btn:hover {
            transform: scale(1.1);
        }
        #xp-panel {
            display: none;
            background-color: #2c3e50; /* Dark background */
            color: #ecf0f1;
            border: 2px solid #d4a017;
            border-radius: 10px;
            padding: 15px;
            width: 300px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            margin-bottom: 10px;
            position: absolute;
            bottom: 60px;
            right: 0;
        }
        #xp-panel h3 { margin-top: 0; color: #d4a017; font-size: 1.1em; border-bottom: 1px solid #555; padding-bottom: 5px; }
        .xp-form-group { margin-bottom: 10px; }
        .xp-form-group label { display: block; font-size: 0.9em; margin-bottom: 3px; }
        .xp-form-group select, .xp-form-group input { 
            width: 100%; 
            padding: 5px; 
            border-radius: 4px; border: none; 
            background: #34495e; color: white;
        }
        #xp-pg-list {
            max-height: 100px;
            overflow-y: auto;
            background: #34495e;
            padding: 5px;
            border-radius: 4px;
        }
        .pg-checkbox { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
        .pg-label { display: flex; align-items: center; flex-grow: 1; }
        .pg-label input { width: auto; margin-right: 8px; }
        .xp-badge { background: #e74c3c; color: white; border-radius: 4px; padding: 2px 4px; font-size: 0.7em; margin-right: 5px; }
        .xp-copy-btn { cursor: pointer; color: #3498db; font-size: 1.1em; }
        .xp-copy-btn:hover { color: #5dade2; }
        #assign-xp-btn {
            background-color: #27ae60;
            color: white;
            border: none;
            width: 100%;
            padding: 8px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
        }
        #assign-xp-btn:hover { background-color: #2ecc71; }
        #assign-xp-btn:hover { background-color: #2ecc71; }
        .xp-session-stats { font-size: 0.8em; color: #bdc3c7; margin-top: 10px; text-align: center; }
        #reset-xp-btn {
            background-color: #c0392b;
            color: white;
            border: none;
            width: 100%;
            padding: 5px;
            border-radius: 5px;
            cursor: pointer;
            margin-top: 10px;
            font-size: 0.8em;
        }
        #reset-xp-btn:hover { background-color: #e74c3c; }
    `;
    document.head.appendChild(style);

    // Create Widget DOM
    const widgetDiv = document.createElement('div');
    widgetDiv.id = 'xp-widget';
    widgetDiv.innerHTML = `
        <div id="xp-panel">
            <h3>Assegna Punti Esperienza</h3>
            
            <div class="xp-form-group">
                <label>Personaggi:</label>
                <div id="xp-pg-list">
                    <!-- Checkboxes injected here -->
                    <div style="font-style:italic; font-size:0.8em;">Caricamento...</div>
                </div>
                <div style="font-size:0.8em; margin-top:2px; cursor:pointer; color:#3498db;" id="xp-select-all">Seleziona Tutti</div>
            </div>

            <div class="xp-form-group">
                <label>Motivazione:</label>
                <select id="xp-reason-select">
                    <option value="">-- Seleziona --</option>
                    <!-- Options injected here -->
                    <option value="custom">Altro (Personalizzato)</option>
                </select>
                <input type="text" id="xp-custom-reason" placeholder="Specifica motivo..." style="display:none; margin-top:5px;">
            </div>

            <div class="xp-form-group">
                <label>Quantità XP:</label>
                <input type="number" id="xp-amount" value="0" min="0">
            </div>

            <button id="assign-xp-btn">Assegna XP</button>
            <button id="reset-xp-btn">Reset XP Selezionati</button>

            <div class="xp-session-stats" id="xp-session-stats">
                Sessione Oggi: 0 XP
            </div>
        </div>
        <button id="xp-widget-btn" title="Gestione XP">★</button>
    `;
    document.body.appendChild(widgetDiv);

    // Logic
    const btn = document.getElementById('xp-widget-btn');
    const panel = document.getElementById('xp-panel');
    const pgList = document.getElementById('xp-pg-list');
    const reasonSelect = document.getElementById('xp-reason-select');
    const customReasonInput = document.getElementById('xp-custom-reason');
    const amountInput = document.getElementById('xp-amount');
    const assignBtn = document.getElementById('assign-xp-btn');
    const selectAllBtn = document.getElementById('xp-select-all');
    const resetBtn = document.getElementById('reset-xp-btn');

    let isOpen = false;
    let catalog = [];

    // Toggle Panel
    btn.onclick = () => {
        isOpen = !isOpen;
        panel.style.display = isOpen ? 'block' : 'none';
        if (isOpen) {
            refreshData();
        }
    };

    // Auto-fill amount based on reason
    reasonSelect.onchange = () => {
        if (reasonSelect.value === 'custom') {
            customReasonInput.style.display = 'block';
            amountInput.value = 0;
        } else {
            customReasonInput.style.display = 'none';
            const item = catalog.find(c => c.reason === reasonSelect.value);
            if (item) amountInput.value = item.amount;
        }
    };

    // Select All
    selectAllBtn.onclick = () => {
        const checks = pgList.querySelectorAll('input[type="checkbox"]');
        const allChecked = Array.from(checks).every(c => c.checked);
        checks.forEach(c => c.checked = !allChecked);
    };

    // Assign XP
    assignBtn.onclick = async () => {
        const checkedPGs = Array.from(pgList.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
        if (checkedPGs.length === 0) {
            alert('Seleziona almeno un PG!');
            return;
        }

        const reason = reasonSelect.value === 'custom' ? customReasonInput.value : reasonSelect.value;
        if (!reason) {
            alert('Inserisci una motivazione!');
            return;
        }

        const amount = parseInt(amountInput.value);
        if (!amount || amount <= 0) {
            alert('Inserisci una quantità valida!');
            return;
        }

        try {
            const response = await fetch('/api/xp/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pg_ids: checkedPGs,
                    amount: amount,
                    reason: reason
                })
            });
            const result = await response.json();
            if (result.success) {
                // Reset form slightly
                reasonSelect.value = "";
                amountInput.value = 0;
                customReasonInput.style.display = "none";
                reasonSelect.value = "";
                amountInput.value = 0;
                customReasonInput.style.display = "none";
                updatePGValues(); // Updates totals and stats without resetting selection
                // Close panel? Maybe keep open for multi-assign? Keep open.
            } else {
                alert('Errore: ' + result.error);
            }
        } catch (e) { console.error(e); }
    };

    // Reset XP Logic
    resetBtn.onclick = async () => {
        const checkedPGs = Array.from(pgList.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
        if (checkedPGs.length === 0) {
            alert('Seleziona almeno un PG per resettare i PX!');
            return;
        }

        if (!confirm('ATTENZIONE: Stai per eliminare TUTTI i Punti Esperienza assegnati ai personaggi selezionati. Questa azione è irreversibile. Continuare?')) {
            return;
        }

        try {
            const response = await fetch('/api/xp/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pg_ids: checkedPGs })
            });
            const result = await response.json();
            if (result.success) {
                alert('Reset effettuato!');
                updatePGValues();
            } else {
                alert('Errore: ' + result.error);
            }
        } catch (e) { console.error(e); }
    };

    async function refreshData() {
        // Load Catalog
        try {
            const res = await fetch('/api/xp/catalog');
            const data = await res.json();
            if (data.success) {
                catalog = data.catalog;
                reasonSelect.innerHTML = '<option value="">-- Seleziona --</option>';
                catalog.forEach(item => {
                    const opt = document.createElement('option');
                    opt.value = item.reason;
                    opt.textContent = `${item.reason} (${item.amount})`;
                    reasonSelect.appendChild(opt);
                });
                const customOpt = document.createElement('option');
                customOpt.value = 'custom';
                customOpt.textContent = 'Altro (Personalizzato)';
                reasonSelect.appendChild(customOpt);
            }
        } catch (e) { console.error('XP Catalog Load Error', e); }

        // Load PGs
        try {
            const res = await fetch('/api/public/pgs');
            const data = await res.json();
            if (data.success) {
                pgList.innerHTML = '';
                data.pgs.forEach(pg => {
                    const div = document.createElement('div');
                    div.className = 'pg-checkbox';

                    const labelDiv = document.createElement('div');
                    labelDiv.className = 'pg-label';
                    labelDiv.innerHTML = `<input type="checkbox" value="${pg.id}" checked> ${pg.name}`;

                    const toolsDiv = document.createElement('div');
                    toolsDiv.style.display = 'flex';
                    toolsDiv.style.alignItems = 'center';

                    const badge = document.createElement('span');
                    badge.className = 'xp-badge';
                    badge.id = `xp-badge-${pg.id}`; // Add ID for updates
                    badge.textContent = `${pg.total_xp} XP`;
                    badge.title = 'Totale XP';

                    const copyBtn = document.createElement('span');
                    copyBtn.className = 'xp-copy-btn';
                    copyBtn.innerHTML = '📋';
                    copyBtn.title = 'Copia report XP';
                    copyBtn.onclick = (e) => {
                        e.stopPropagation(); // Prevent toggling check
                        exportPGData(pg.id, pg.name);
                    };

                    toolsDiv.appendChild(badge);
                    toolsDiv.appendChild(copyBtn);

                    div.appendChild(labelDiv);
                    div.appendChild(toolsDiv);

                    pgList.appendChild(div);
                });
            }
        } catch (e) { console.error('PG Load Error', e); }

        updateStats();
    }

    async function exportPGData(id, name) {
        try {
            const res = await fetch(`/api/xp/export/${id}`);
            const data = await res.json();
            if (data.success) {
                let text = `${data.total}\t"`;
                data.log.forEach(item => {
                    text += `${item.reason}: ${item.amount}\n`;
                });
                text += `"`;

                // Copy to clipboard
                await navigator.clipboard.writeText(text);
                alert(`Report XP per ${name} copiato negli appunti!`);
            } else {
                alert('Errore export: ' + (data.error || 'Unknown'));
            }
        } catch (e) { console.error('Export Error', e); }
    }



    async function updatePGValues() {
        try {
            const res = await fetch('/api/public/pgs');
            const data = await res.json();
            if (data.success) {
                data.pgs.forEach(pg => {
                    const badge = document.getElementById(`xp-badge-${pg.id}`);
                    if (badge) {
                        badge.textContent = `${pg.total_xp} XP`;
                    }
                });
            }
        } catch (e) { console.error('Update PG Error', e); }
        updateStats(); // Chain call
    }
});
