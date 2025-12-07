let npcs = [];
let modifiedNpcs = [];
let combatants = [];
let chaosMutations = [];
let allSkills = [];
let selectedSkills = [];

let careersData = [];

document.addEventListener('DOMContentLoaded', () => {
    loadNPCs();
    loadModifiedNPCs();
    loadMutations();
    loadSkills();
    loadTalents();
    loadCareers();
    loadPlayerCharacters();
    setupSkillInput();
    setupTalentInput();
});


// --- CAREER FUNCTIONS ---

async function loadCareers() {
    try {
        const response = await fetch('/api/careers');
        const data = await response.json();
        if (data.success) {
            careersData = data.careers;
            populateCareerSelect();
        }
    } catch (e) {
        console.error('Error loading careers:', e);
    }
}

function populateCareerSelect() {
    const select = document.getElementById('careerSelect');
    // Clear existing options except the first one
    select.innerHTML = '<option value="">-- Seleziona Carriera --</option>';

    // Sort alphabetically
    const sorted = [...careersData].sort((a, b) => a.name.localeCompare(b.name));

    sorted.forEach(career => {
        const option = document.createElement('option');
        option.value = career.id;
        option.textContent = career.name;
        select.appendChild(option);
    });
}

async function applyCareerToNPC() {
    const select = document.getElementById('careerSelect');
    const careerId = select.value;

    if (!careerId) {
        alert('Seleziona una carriera prima di applicarla');
        return;
    }

    const career = careersData.find(c => c.id == careerId);
    if (!career) {
        alert('Carriera non trovata');
        return;
    }

    // Sum stats (AC, AB, F, R, Ag, Int, Vol, Sim, A, Fe, M, Mag, Fol, PF)
    const statFields = ['ws', 'bs', 's', 't', 'ag', 'int', 'wp', 'fel', 'a', 'w', 'm', 'mag', 'ip', 'fp'];
    statFields.forEach(stat => {
        const input = document.getElementById(stat);
        const currentValue = parseInt(input.value) || 0;
        const careerValue = parseInt(career[stat]) || 0;
        input.value = currentValue + careerValue;
    });

    // Merge skills (allowing duplicates)
    if (career.skills) {
        const careerSkills = career.skills.split(',').map(s => s.trim()).filter(s => s);
        careerSkills.forEach(skillName => {
            // Add skill directly without checking for duplicates
            selectedSkills.push(skillName);
        });
        renderSkillTags();
    }

    // Merge talents (allowing duplicates)
    if (career.talents) {
        const careerTalents = career.talents.split(',').map(t => t.trim()).filter(t => t);
        careerTalents.forEach(talentName => {
            // Add talent directly without checking for duplicates
            selectedTalents.push(talentName);
        });
        renderTalentTags();
    }

    // Merge trappings to equipment
    if (career.trappings) {
        const equipmentTextarea = document.getElementById('equipment');
        const currentEquipment = equipmentTextarea.value.trim();
        const careerTrappings = career.trappings.trim();

        if (currentEquipment && careerTrappings) {
            equipmentTextarea.value = currentEquipment + ', ' + careerTrappings;
        } else if (careerTrappings) {
            equipmentTextarea.value = careerTrappings;
        }
    }

    alert(`Carriera "${career.name}" applicata con successo!\n\nStatistiche sommate, abilità e talenti aggiunti (duplicati consentiti), ferri del mestiere aggiunti all'equipaggiamento.`);
}

// --- END CAREER FUNCTIONS ---

async function loadMutations() {
    try {
        const response = await fetch('/api/chaos_mutations');
        const data = await response.json();
        if (data.success) {
            chaosMutations = data.mutations;
            populateMutationSelect();
        }
    } catch (e) {
        console.error('Error loading mutations:', e);
    }
}

function populateMutationSelect() {
    const select = document.getElementById('mutationSelect');
    // Sort alphabetically
    const sorted = [...chaosMutations].sort((a, b) => a.mutation.localeCompare(b.mutation));

    sorted.forEach(m => {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.mutation;
        select.appendChild(option);
    });
}

function addRandomMutation() {
    if (chaosMutations.length === 0) return;

    const roll = Math.floor(Math.random() * 100) + 1;
    const mutation = chaosMutations.find(m => roll >= parseInt(m.min_dice) && roll <= parseInt(m.max_dice));

    if (mutation) {
        appendMutation(mutation);
        alert(`Tiro d100: ${roll} - Aggiunta mutazione: ${mutation.mutation}`);
    } else {
        alert(`Tiro d100: ${roll} - Nessuna mutazione trovata (o errore nei dati)`);
    }
}

function addSelectedMutation() {
    const select = document.getElementById('mutationSelect');
    const id = select.value;
    if (!id) return;

    const mutation = chaosMutations.find(m => m.id == id);
    if (mutation) {
        appendMutation(mutation);
    }
}

function appendMutation(mutation) {
    const textarea = document.getElementById('description');
    const text = `\n[Mutazione] ${mutation.mutation}: ${mutation.effect}`;
    textarea.value += textarea.value ? text : text.trim();
}

async function loadSkills() {
    try {
        const response = await fetch('/api/skills');
        const data = await response.json();
        if (data.success) {
            allSkills = data.skills;
        }
    } catch (e) {
        console.error('Error loading skills:', e);
    }
}

function setupSkillInput() {
    const input = document.getElementById('skillInput');
    const suggestions = document.getElementById('skillSuggestions');

    input.addEventListener('input', (e) => {
        const value = e.target.value.toLowerCase();
        if (value.length < 2) {
            suggestions.style.display = 'none';
            return;
        }

        const filtered = allSkills.filter(skill =>
            skill.name.toLowerCase().includes(value) &&
            !selectedSkills.includes(skill.name)
        );

        if (filtered.length > 0) {
            suggestions.innerHTML = filtered.map(skill =>
                `<li data-skill-name="${skill.name}">${skill.name}</li>`
            ).join('');
            suggestions.style.display = 'block';
        } else {
            suggestions.style.display = 'none';
        }
    });

    suggestions.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            const skillName = e.target.dataset.skillName;
            addSkill(skillName);
            input.value = '';
            suggestions.style.display = 'none';
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const firstSuggestion = suggestions.querySelector('li');
            if (firstSuggestion) {
                addSkill(firstSuggestion.dataset.skillName);
                input.value = '';
                suggestions.style.display = 'none';
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target !== input) {
            suggestions.style.display = 'none';
        }
    });
}

// --- TALENT FUNCTIONS ---

async function loadTalents() {
    try {
        const response = await fetch('/api/talents');
        const data = await response.json();
        if (data.success) {
            allTalents = data.talents;
        }
    } catch (e) {
        console.error('Error loading talents:', e);
    }
}

function setupTalentInput() {
    const input = document.getElementById('talentInput');
    const suggestions = document.getElementById('talentSuggestions');

    input.addEventListener('input', (e) => {
        const value = e.target.value.toLowerCase();
        if (value.length < 2) {
            suggestions.style.display = 'none';
            return;
        }

        // Allow duplicates - don't filter out already selected talents
        const filtered = allTalents.filter(talent =>
            talent.name.toLowerCase().includes(value)
        );

        if (filtered.length > 0) {
            suggestions.innerHTML = filtered.map(talent =>
                `<li data-talent-name="${talent.name}">${talent.name}</li>`
            ).join('');
            suggestions.style.display = 'block';
        } else {
            suggestions.style.display = 'none';
        }
    });

    suggestions.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            const talentName = e.target.dataset.talentName;
            addTalent(talentName);
            input.value = '';
            suggestions.style.display = 'none';
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const firstSuggestion = suggestions.querySelector('li');
            if (firstSuggestion) {
                addTalent(firstSuggestion.dataset.talentName);
                input.value = '';
                suggestions.style.display = 'none';
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target !== input) {
            suggestions.style.display = 'none';
        }
    });
}

function addTalent(talentName) {
    // Handle (varie) replacement like skills
    if (talentName.includes('(varie)')) {
        const replacement = prompt('Questo talento contiene "(varie)". Inserisci il testo da sostituire a "varie":', '');
        if (replacement === null) return;
        if (replacement.trim() === '') {
            alert('Devi inserire un valore per sostituire "varie"');
            return;
        }
        talentName = talentName.replace('(varie)', `(${replacement.trim()})`);
    }

    // Allow duplicates - always add
    selectedTalents.push(talentName);
    renderTalentTags();
}

function removeTalent(index) {
    selectedTalents.splice(index, 1);
    renderTalentTags();
}

function renderTalentTags() {
    const container = document.getElementById('talentsContainer');
    container.innerHTML = selectedTalents.map((talentName, index) => {
        let talent = allTalents.find(t => t.name === talentName);
        if (!talent && talentName.includes('(') && talentName.includes(')')) {
            const baseTalentName = talentName.replace(/\([^)]+\)/, '(varie)');
            talent = allTalents.find(t => t.name === baseTalentName);
        }

        const tooltipHtml = talent ? `
                <div class="tooltip-content">
                    <strong>${talent.name}</strong><br>
                    <em>Descrizione:</em> ${talent.description || 'N/A'}
                </div>
            ` : '';

        return `
                <span class="tag">
                    ${talentName}
                    <span class="tag-remove" onclick="removeTalent(${index})">&times;</span>
                    ${tooltipHtml}
                </span>
            `;
    }).join('');
}

// --- END TALENT FUNCTIONS ---

function addSkill(skillName) {
    if (skillName.includes('(varie)')) {
        const replacement = prompt('Questa abilità contiene "(varie)". Inserisci il testo da sostituire a "varie":', '');
        if (replacement === null) return;
        if (replacement.trim() === '') {
            alert('Devi inserire un valore per sostituire "varie"');
            return;
        }
        skillName = skillName.replace('(varie)', `(${replacement.trim()})`);
    }

    if (!selectedSkills.includes(skillName)) {
        selectedSkills.push(skillName);
        renderSkillTags();
    }
}

function removeSkill(skillName) {
    selectedSkills = selectedSkills.filter(s => s !== skillName);
    renderSkillTags();
}

function renderSkillTags() {
    const container = document.getElementById('skillsContainer');
    container.innerHTML = selectedSkills.map(skillName => {
        let skill = allSkills.find(s => s.name === skillName);
        if (!skill && skillName.includes('(') && skillName.includes(')')) {
            const baseSkillName = skillName.replace(/\([^)]+\)/, '(varie)');
            skill = allSkills.find(s => s.name === baseSkillName);
        }

        const tooltipHtml = skill ? `
                <div class="tooltip-content">
                    <strong>${skill.name}</strong><br>
                    <em>Tipo:</em> ${skill.type || 'N/A'}<br>
                    <em>Caratteristica:</em> ${skill.characteristic || 'N/A'}<br>
                    <em>Descrizione:</em> ${skill.description || 'N/A'}
                </div>
            ` : '';

        return `
                <span class="tag">
                    ${skillName}
                    <span class="tag-remove" onclick="removeSkill('${skillName}')">&times;</span>
                    ${tooltipHtml}
                </span>
            `;
    }).join('');
}

function getSkillBadgeHTML(skillName) {
    let skill = allSkills.find(s => s.name === skillName);
    if (!skill && skillName.includes('(') && skillName.includes(')')) {
        const baseSkillName = skillName.replace(/\([^)]+\)/, '(varie)');
        skill = allSkills.find(s => s.name === baseSkillName);
    }

    if (!skill) return `<span class="skill-badge">${skillName}</span>`;

    return `
            <span class="skill-badge">
                ${skillName}
                <div class="tooltip-content">
                    <strong>${skill.name}</strong><br>
                    <em>Tipo:</em> ${skill.type || 'N/A'}<br>
                    <em>Caratteristica:</em> ${skill.characteristic || 'N/A'}<br>
                    <em>Descrizione:</em> ${skill.description || 'N/A'}
                </div>
            </span>
        `;
}

function getTalentBadgeHTML(talentName) {
    let talent = allTalents.find(t => t.name === talentName);
    if (!talent && talentName.includes('(') && talentName.includes(')')) {
        const baseTalentName = talentName.replace(/\([^)]+\)/, '(varie)');
        talent = allTalents.find(t => t.name === baseTalentName);
    }

    if (!talent) return `<span class="skill-badge">${talentName}</span>`;

    return `
            <span class="skill-badge">
                ${talentName}
                <div class="tooltip-content">
                    <strong>${talent.name}</strong><br>
                    <em>Descrizione:</em> ${talent.description || 'N/A'}
                </div>
            </span>
        `;
}



async function loadNPCs() {
    try {
        const response = await fetch('/api/npcs');
        const data = await response.json();
        if (data.success) {
            npcs = data.npcs;
            renderNPCTable();
        }
    } catch (e) {
        console.error('Error loading NPCs:', e);
    }
}

function renderNPCs() {
    const container = document.getElementById('npcList');
    container.innerHTML = '';

    npcs.forEach(npc => {
        const card = document.createElement('div');
        card.className = 'npc-card';
        card.innerHTML = `
                <div class="npc-name">
                    ${npc.name}
                    <span style="font-size:0.8rem; color:#aaa; font-weight:normal;">${npc.traits || ''}</span>
                    <span style="font-size:0.7rem; color:#ffd700; font-weight:bold; margin-left:8px; background:#333; padding:2px 6px; border-radius:3px;">ID: ${npc.id}</span>
                </div>
                <div class="npc-stats">
                    <div class="stat-box"><div class="stat-label">AC</div><div class="stat-value">${npc.ws || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">AB</div><div class="stat-value">${npc.bs || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">F</div><div class="stat-value">${npc.s || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">R</div><div class="stat-value">${npc.t || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">Ag</div><div class="stat-value">${npc.ag || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">Int</div><div class="stat-value">${npc.int || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">Vol</div><div class="stat-value">${npc.wp || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">Sim</div><div class="stat-value">${npc.fel || '-'}</div></div>
                </div>
                <div class="secondary-stats">
                    <span><strong>A:</strong> ${npc.a || '-'}</span>
                    <span><strong>Fe:</strong> ${npc.w || '-'}</span>
                    <span><strong>M:</strong> ${npc.m || '-'}</span>
                </div>
                <div class="npc-actions">
                    <button class="btn btn-add" onclick="addToCombat(${npc.id})">Aggiungi al Combattimento</button>
                    <button class="btn btn-edit" onclick="editNPC(${npc.id})">Modifica</button>
                    <button class="btn btn-danger" onclick="deleteNPC(${npc.id})">Elimina</button>
                </div>
            `;
        container.appendChild(card);
    });
}



// --- NPC TABLE FUNCTIONS ---

function renderNPCTable() {
    const tbody = document.getElementById('npcTableBody');
    const emptyDiv = document.getElementById('npcTableEmpty');
    const table = document.getElementById('npcTable');

    if (!tbody) return;

    tbody.innerHTML = '';

    if (npcs.length === 0) {
        table.style.display = 'none';
        emptyDiv.style.display = 'block';
        emptyDiv.textContent = 'Nessun PNG nella libreria.';
        return;
    }

    table.style.display = 'table';
    emptyDiv.style.display = 'none';


    // Ordina i PNG alfabeticamente per nome
    npcs.sort((a, b) => a.name.localeCompare(b.name));

    npcs.forEach(npc => {
        const row = document.createElement('tr');
        row.dataset.npcId = npc.id;
        row.dataset.npcName = (npc.name || '').toLowerCase();
        row.dataset.npcSkills = (npc.skills || '').toLowerCase();
        row.dataset.npcTalents = (npc.talents || '').toLowerCase();

        // Formatta abilita e talenti per la visualizzazione
        const skillsHtml = npc.skills ?
            npc.skills.split(',').map(s => `<span class="skill-badge-small">${s.trim()}</span>`).join(' ') :
            '-';
        const talentsHtml = npc.talents ?
            npc.talents.split(',').map(t => `<span class="skill-badge-small">${t.trim()}</span>`).join(' ') :
            '-';

        row.innerHTML = `
                <td style="color: #ffd700; font-weight: bold;">${npc.id}</td>
                <td style="font-weight: bold;">${npc.name}</td>
                <td style="color: #aaa; font-size: 0.8rem;">${npc.traits || '-'}</td>
                <td style="text-align: center;">${npc.ws || '-'}</td>
                <td style="text-align: center;">${npc.bs || '-'}</td>
                <td style="text-align: center;">${npc.s || '-'}</td>
                <td style="text-align: center;">${npc.t || '-'}</td>
                <td style="text-align: center;">${npc.ag || '-'}</td>
                <td style="text-align: center;">${npc.int || '-'}</td>
                <td style="text-align: center;">${npc.wp || '-'}</td>
                <td style="text-align: center;">${npc.fel || '-'}</td>
                <td style="text-align: center;">${npc.a || '-'}</td>
                <td style="text-align: center;">${npc.w || '-'}</td>
                <td style="text-align: center;">${npc.m || '-'}</td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${skillsHtml}</td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${talentsHtml}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-add btn-icon" onclick="addToCombat(${npc.id})" title="Aggiungi al Combattimento"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
                        <button class="btn btn-primary btn-icon" onclick="copyNPC(${npc.id})" title="Copia come PNG Modificato"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                        <button class="btn btn-success btn-icon" onclick="duplicateNPC(${npc.id})" title="Duplica PNG"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="7" width="14" height="14" rx="2" ry="2"></rect><path d="M3 17V5a2 2 0 0 1 2-2h12"></path></svg></button>
                        <button class="btn btn-edit btn-icon" onclick="editNPC(${npc.id})" title="Modifica PNG"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                        <button class="btn btn-danger btn-icon" onclick="deleteNPC(${npc.id})" title="Elimina PNG"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
                    </div>
                </td>
            `;

        tbody.appendChild(row);
    });
}

function filterNPCTable() {
    const nameFilter = document.getElementById('searchName').value.toLowerCase();
    const skillFilter = document.getElementById('searchSkill').value.toLowerCase();
    const talentFilter = document.getElementById('searchTalent').value.toLowerCase();

    const tbody = document.getElementById('npcTableBody');
    const rows = tbody.getElementsByTagName('tr');
    const emptyDiv = document.getElementById('npcTableEmpty');
    const table = document.getElementById('npcTable');

    let visibleCount = 0;

    for (let row of rows) {
        const name = row.dataset.npcName || '';
        const skills = row.dataset.npcSkills || '';
        const talents = row.dataset.npcTalents || '';

        const matchName = !nameFilter || name.includes(nameFilter);
        const matchSkill = !skillFilter || skills.includes(skillFilter);
        const matchTalent = !talentFilter || talents.includes(talentFilter);

        if (matchName && matchSkill && matchTalent) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    }

    if (visibleCount === 0) {
        table.style.display = 'none';
        emptyDiv.style.display = 'block';
        emptyDiv.textContent = 'Nessun PNG corrisponde ai criteri di ricerca.';
    } else {
        table.style.display = 'table';
        emptyDiv.style.display = 'none';
    }
}

function clearNPCFilters() {
    document.getElementById('searchName').value = '';
    document.getElementById('searchSkill').value = '';
    document.getElementById('searchTalent').value = '';
    filterNPCTable();
}

// --- END NPC TABLE FUNCTIONS ---

async function loadModifiedNPCs() {
    try {
        const response = await fetch('/api/modified_npcs');
        const data = await response.json();
        if (data.success) {
            modifiedNpcs = data.modified_npcs;
            renderModifiedNPCs();
        }
    } catch (e) {
        console.error('Error loading modified NPCs:', e);
    }
}

function renderModifiedNPCs() {
    const container = document.getElementById('modifiedNpcList');
    if (!container) return;
    container.innerHTML = '';

    if (modifiedNpcs.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 2rem;">Nessun PNG modificato. Crea un nuovo PNG modificato partendo da un PNG base.</div>';
        return;
    }

    modifiedNpcs.forEach(npc => {
        const card = document.createElement('div');
        card.className = 'npc-card';
        card.style.borderColor = '#28a745';

        card.innerHTML = `
                <div class="npc-name">
                    ${npc.name}
                    <span style="font-size:0.8rem; color:#aaa; font-weight:normal;">${npc.traits || ''}</span>
                </div>
                <div class="npc-stats">
                    <div class="stat-box"><div class="stat-label">AC</div><div class="stat-value">${npc.ws || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">AB</div><div class="stat-value">${npc.bs || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">F</div><div class="stat-value">${npc.s || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">R</div><div class="stat-value">${npc.t || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">Ag</div><div class="stat-value">${npc.ag || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">Int</div><div class="stat-value">${npc.int || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">Vol</div><div class="stat-value">${npc.wp || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">Sim</div><div class="stat-value">${npc.fel || '-'}</div></div>
                </div>
                <div class="secondary-stats">
                    <span><strong>A:</strong> ${npc.a || '-'}</span>
                    <span><strong>Fe:</strong> ${npc.w || '-'}</span>
                    <span><strong>M:</strong> ${npc.m || '-'}</span>
                </div>
                <div class="npc-actions">
                    <button class="btn btn-add" onclick="addModifiedToCombat(${npc.id})">Aggiungi al Combattimento</button>
                    <button class="btn btn-edit" onclick="editModifiedNPC(${npc.id})">Modifica</button>
                    <button class="btn btn-danger" onclick="deleteModifiedNPC(${npc.id})">Elimina</button>
                </div>
            `;
        container.appendChild(card);
    });
}

function createModifiedNPC() {
    const baseNpcId = prompt('Inserisci ID del PNG base (o lascia vuoto per vedere la lista):');
    if (baseNpcId === null) return;

    if (baseNpcId === '') {
        let npcList = 'PNG Disponibili:\n\n';
        npcs.forEach(npc => {
            npcList += `ID: ${npc.id} - ${npc.name}\n`;
        });
        alert(npcList);
        createModifiedNPC();
        return;
    }

    const baseNpc = npcs.find(n => n.id == parseInt(baseNpcId));
    if (!baseNpc) {
        alert('PNG non trovato!');
        return;
    }
    openModalForModified(baseNpc);
}

function copyNPC(npcId) {
    const baseNpc = npcs.find(n => n.id === npcId);
    if (!baseNpc) {
        alert('PNG non trovato!');
        return;
    }
    openModalForModified(baseNpc);
}

function duplicateNPC(npcId) {
    const baseNpc = npcs.find(n => n.id === npcId);
    if (!baseNpc) {
        alert('PNG non trovato!');
        return;
    }

    // Open modal for creating a new PNG (not modified)
    const modal = document.getElementById('npcModal');
    const form = document.getElementById('npcForm');
    const title = document.getElementById('modalTitle');

    title.innerText = `Duplica PNG: ${baseNpc.name}`;
    form.reset();
    document.getElementById('npcId').value = '';
    document.getElementById('combatantInstanceId').value = '';

    // Remove any hidden fields for modified NPCs
    const baseNpcIdField = document.getElementById('baseNpcId');
    if (baseNpcIdField) baseNpcIdField.remove();
    const modifiedNpcIdField = document.getElementById('modifiedNpcId');
    if (modifiedNpcIdField) modifiedNpcIdField.remove();

    // Populate with base NPC data
    document.getElementById('name').value = baseNpc.name + ' (Copia)';
    document.getElementById('traits').value = baseNpc.traits || '';
    document.getElementById('description').value = baseNpc.description || '';

    ['ws', 'bs', 's', 't', 'ag', 'int', 'wp', 'fel', 'a', 'w', 'm', 'mag', 'ip', 'fp',
        'armor_head', 'armor_arms', 'armor_body', 'armor_legs'].forEach(stat => {
            document.getElementById(stat).value = baseNpc[stat] || '';
        });

    ['special_rules', 'armor', 'weapons', 'equipment'].forEach(field => {
        document.getElementById(field).value = baseNpc[field] || '';
    });

    selectedSkills = baseNpc.skills ? baseNpc.skills.split(',').map(s => s.trim()).filter(s => s) : [];
    selectedTalents = baseNpc.talents ? baseNpc.talents.split(',').map(t => t.trim()).filter(t => t) : [];
    renderSkillTags();
    renderTalentTags();

    // Hide mutation and career controls for library PNGs
    document.getElementById('mutationControls').style.display = 'none';
    document.getElementById('careerControls').style.display = 'none';

    modal.style.display = 'block';
}

function openModalForModified(baseNpc) {
    const modal = document.getElementById('npcModal');
    const form = document.getElementById('npcForm');
    const title = document.getElementById('modalTitle');

    title.innerText = `Nuovo PNG Modificato (Base: ${baseNpc.name})`;
    form.reset();
    document.getElementById('npcId').value = '';
    document.getElementById('combatantInstanceId').value = '';

    if (!document.getElementById('baseNpcId')) {
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.id = 'baseNpcId';
        form.appendChild(hiddenInput);
    }
    document.getElementById('baseNpcId').value = baseNpc.id;

    document.getElementById('name').value = baseNpc.name + ' (Modificato)';
    document.getElementById('traits').value = baseNpc.traits || '';
    document.getElementById('description').value = baseNpc.description || '';

    ['ws', 'bs', 's', 't', 'ag', 'int', 'wp', 'fel', 'a', 'w', 'm', 'mag', 'ip', 'fp',
        'armor_head', 'armor_arms', 'armor_body', 'armor_legs'].forEach(stat => {
            document.getElementById(stat).value = baseNpc[stat] || '';
        });

    ['special_rules', 'armor', 'weapons', 'equipment'].forEach(field => {
        document.getElementById(field).value = baseNpc[field] || '';
    });

    selectedSkills = baseNpc.skills ? baseNpc.skills.split(',').map(s => s.trim()).filter(s => s) : [];
    selectedTalents = baseNpc.talents ? baseNpc.talents.split(',').map(t => t.trim()).filter(t => t) : [];
    renderSkillTags();
    renderTalentTags();

    modal.style.display = 'block';
}

function editModifiedNPC(id) {
    const npc = modifiedNpcs.find(n => n.id === id);
    if (npc) {
        const modal = document.getElementById('npcModal');
        const form = document.getElementById('npcForm');
        const title = document.getElementById('modalTitle');

        title.innerText = 'Modifica PNG Modificato';

        if (!document.getElementById('modifiedNpcId')) {
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.id = 'modifiedNpcId';
            form.appendChild(hiddenInput);
        }
        document.getElementById('modifiedNpcId').value = npc.id;

        if (!document.getElementById('baseNpcId')) {
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.id = 'baseNpcId';
            form.appendChild(hiddenInput);
        }
        document.getElementById('baseNpcId').value = npc.base_npc_id;

        document.getElementById('npcId').value = '';
        document.getElementById('combatantInstanceId').value = '';

        document.getElementById('name').value = npc.name;
        document.getElementById('traits').value = npc.traits || '';
        document.getElementById('description').value = npc.description || '';

        ['ws', 'bs', 's', 't', 'ag', 'int', 'wp', 'fel', 'a', 'w', 'm', 'mag', 'ip', 'fp',
            'armor_head', 'armor_arms', 'armor_body', 'armor_legs'].forEach(stat => {
                document.getElementById(stat).value = npc[stat] || '';
            });

        ['special_rules', 'armor', 'weapons', 'equipment'].forEach(field => {
            document.getElementById(field).value = npc[field] || '';
        });

        selectedSkills = npc.skills ? npc.skills.split(',').map(s => s.trim()).filter(s => s) : [];
        selectedTalents = npc.talents ? npc.talents.split(',').map(t => t.trim()).filter(t => t) : [];
        renderSkillTags();
        renderTalentTags();

        modal.style.display = 'block';
    }
}

async function deleteModifiedNPC(id) {
    if (!confirm('Sei sicuro di voler eliminare questo PNG modificato?')) return;
    try {
        const response = await fetch(`/api/modified_npcs/${id}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
            loadModifiedNPCs();
        }
    } catch (e) {
        console.error('Error deleting modified NPC:', e);
    }
}

function sortCombatants() {
    // Sorts combatants by Initiative in descending order
    combatants.sort((a, b) => {
        const initA = parseInt(a.initiative) || 0;
        const initB = parseInt(b.initiative) || 0;

        // If initiative is equal, you can use Agility as a tie-breaker
        if (initA === initB) {
            const agA = parseInt(a.ag) || 0;
            const agB = parseInt(b.ag) || 0;
            return agB - agA;
        }

        return initB - initA;
    });

    renderCombatants();
}

function addModifiedToCombat(modifiedNpcId) {
    const npc = modifiedNpcs.find(n => n.id === modifiedNpcId);
    if (!npc) return;

    const ag = npc.ag || 0;
    const d10 = Math.floor(Math.random() * 10) + 1;
    const initiative = ag + d10;

    const combatant = {
        ...JSON.parse(JSON.stringify(npc)),
        instanceId: Date.now() + Math.random(),
        currentWounds: npc.w || 0,
        isModified: true,
        initiative: initiative,
        initiativeRoll: d10
    };

    combatants.push(combatant);
    sortCombatants();
}


function renderCombatants() {
    const pgContainer = document.getElementById('pgCombatantList');
    const npcContainer = document.getElementById('npcCombatantList');
    const initContainer = document.getElementById('initiativeSidebar');

    if (!pgContainer || !npcContainer || !initContainer) return;

    pgContainer.innerHTML = '';
    npcContainer.innerHTML = '';
    initContainer.innerHTML = '';

    if (combatants.length === 0) {
        pgContainer.innerHTML = '<div style="text-align: center; color: #666; padding: 1rem;">Nessun PG</div>';
        npcContainer.innerHTML = '<div style="text-align: center; color: #666; padding: 1rem;">Nessun PNG</div>';
        initContainer.innerHTML = '<div style="text-align: center; color: #666; padding: 1rem;">-</div>';
        return;
    }

    // Render Initiative Sidebar (Sorted List)
    combatants.forEach(c => {
        const item = document.createElement('div');
        item.className = `initiative-item ${c.isPG ? 'is-pg' : 'is-npc'}`;
        item.innerHTML = `
            <span class="init-name">${c.name}</span>
            <span class="init-value">${c.initiative || 0}</span>
        `;
        initContainer.appendChild(item);
    });

    // Render Combatant Cards
    combatants.forEach((combatant, index) => {
        const isPG = combatant.isPG;
        const container = isPG ? pgContainer : npcContainer;
        
        const card = document.createElement('div');
        card.className = 'npc-card combatant';
        if (isPG) card.style.borderColor = '#007bff';

        // Calculate color for wounds
        const woundPct = (combatant.currentWounds / combatant.w) * 100;
        let woundColor = '#28a745';
        if (woundPct < 50) woundColor = '#ffc107';
        if (woundPct < 25) woundColor = '#dc3545';

        // Target Options
        // If I am PG, I can target NPCs. If I am NPC, I can target PGs.
        // Or allow targeting anyone? "bidirezionale, un combattente contro l'altro" implies opposing sides usually.
        // Let's allow targeting anyone from the OTHER list to keep it clean, or anyone?
        // Let's filter for opposite type for now as it makes most sense.
        const potentialTargets = combatants.filter(c => c.isPG !== isPG);
        
        let targetOptions = '<option value="">-- Nessun Target --</option>';
        potentialTargets.forEach(t => {
            const selected = combatant.targetId === t.instanceId ? 'selected' : '';
            targetOptions += `<option value="${t.instanceId}" ${selected}>${t.name}</option>`;
        });

        // Find who is targeting ME
        const targetedBy = combatants.filter(c => c.targetId === combatant.instanceId);
        let targetedByHtml = '';
        if (targetedBy.length > 0) {
            const names = targetedBy.map(c => c.name).join(', ');
            targetedByHtml = `<div class="targeted-by">Ingaggiato da: ${names}</div>`;
        }

        card.innerHTML = `
            <div class="npc-name">
                <div>${combatant.name}</div>
                <div style="font-size: 0.9rem; color: #00ffff; border: 1px solid #00aaaa; padding: 2px 6px; border-radius: 4px;">
                    INIZ: ${combatant.initiative || 0}
                </div>
            </div>
            
            <div class="wounds-display">
                <div style="font-size:0.8rem; color:#ffaaaa; margin-bottom:2px;">FERITE ATTUALI</div>
                <input type="number" class="wounds-input" 
                    value="${combatant.currentWounds}" 
                    onchange="updateCombatantWounds(${combatant.instanceId}, this.value)"
                    style="color: ${woundColor}"
                >
                <span style="color:#aaa;"> / ${combatant.w}</span>
            </div>

            <div class="target-control">
                <label style="font-size: 0.8rem; color: #aaa;">Target:</label>
                <select class="target-select" onchange="updateTarget(${combatant.instanceId}, this.value)">
                    ${targetOptions}
                </select>
                ${targetedByHtml}
            </div>

            <div class="npc-stats">
                <div class="stat-box"><div class="stat-label">AC</div><div class="stat-value">${combatant.ws || '-'}</div></div>
                <div class="stat-box"><div class="stat-label">AB</div><div class="stat-value">${combatant.bs || '-'}</div></div>
                <div class="stat-box"><div class="stat-label">F</div><div class="stat-value">${combatant.s || '-'}</div></div>
                <div class="stat-box"><div class="stat-label">R</div><div class="stat-value">${combatant.t || '-'}</div></div>
                <div class="stat-box"><div class="stat-label">Ag</div><div class="stat-value">${combatant.ag || '-'}</div></div>
                <div class="stat-box"><div class="stat-label">Int</div><div class="stat-value">${combatant.int || '-'}</div></div>
                <div class="stat-box"><div class="stat-label">Vol</div><div class="stat-value">${combatant.wp || '-'}</div></div>
                <div class="stat-box"><div class="stat-label">Sim</div><div class="stat-value">${combatant.fel || '-'}</div></div>
            </div>

            <div style="font-size:0.8rem; color:#ccc; margin-bottom:0.5rem;">
                 <div><strong>Armatura:</strong> T:${combatant.armor_head || 0} B:${combatant.armor_arms || 0} C:${combatant.armor_body || 0} G:${combatant.armor_legs || 0}</div>
                 <div><strong>Armi:</strong> ${combatant.weapons || '-'}</div>
            </div>

            <div class="npc-actions">
                <button class="btn btn-edit" onclick="editCombatant(${combatant.instanceId})">Modifica</button>
                <button class="btn btn-danger" onclick="removeFromCombat(${combatant.instanceId})">Rimuovi</button>
                ${combatant.currentWounds < 0 ? `
                    <button class="btn btn-warning" onclick="handleCriticalHit(${combatant.instanceId})" style="background: #ff6b00; color: #fff; font-weight: bold;">⚠️ Critico</button>
                    <button class="btn btn-danger" onclick="handleDeath(${combatant.instanceId})" style="background: #8b0000; color: #fff; font-weight: bold;">💀 Morto</button>
                ` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

function updateTarget(sourceId, targetId) {
    const source = combatants.find(c => c.instanceId === sourceId);
    if (!source) return;

    if (!targetId) {
        // Deselect
        const oldTargetId = source.targetId;
        source.targetId = null;
        
        // Remove reverse link
        if (oldTargetId) {
            const oldTarget = combatants.find(c => c.instanceId == oldTargetId);
            if (oldTarget && oldTarget.targetId === sourceId) {
                oldTarget.targetId = null;
            }
        }
    } else {
        // Select new target
        const target = combatants.find(c => c.instanceId == targetId);
        if (target) {
            // Clear old links for source
             if (source.targetId) {
                const oldTarget = combatants.find(c => c.instanceId == source.targetId);
                if (oldTarget && oldTarget.targetId === sourceId) {
                    oldTarget.targetId = null;
                }
            }
            // Clear old links for target (if they were targeting someone else, should they switch to me? 
            // Or can they be targeted by multiple people but only target one?
            // "bidirezionale" implies 1-to-1 usually in this context (duello/ingaggio). 
            // Let's assume 1-to-1 engagement for now.
            if (target.targetId) {
                 const oldSource = combatants.find(c => c.instanceId == target.targetId);
                 if (oldSource && oldSource.targetId === target.instanceId) {
                     oldSource.targetId = null;
                 }
            }
            
            // Set new links
            source.targetId = parseFloat(targetId);
            target.targetId = sourceId;
        }
    }
    
    renderCombatants();
}

function addToCombat(npcId) {
    const npc = npcs.find(n => n.id === npcId);
    if (!npc) return;

    // Create a deep copy and add instance properties
    const ag = npc.ag || 0;
    const d10 = Math.floor(Math.random() * 10) + 1;
    const initiative = ag + d10;

    const combatant = {
        ...JSON.parse(JSON.stringify(npc)),
        instanceId: Date.now() + Math.random(), // Unique ID for this instance
        currentWounds: npc.w || 0,
        initiative: initiative,
        initiativeRoll: d10 // Store the roll for reference if needed
    };

    combatants.push(combatant);
    sortCombatants();
}

function removeFromCombat(instanceId) {
    combatants = combatants.filter(c => c.instanceId !== instanceId);
    sortCombatants();
}

function clearCombat() {
    if (confirm('Svuotare tutti i combattenti attivi?')) {
        combatants = [];
        sortCombatants();
    }
}

function updateCombatantWounds(instanceId, value) {
    const combatant = combatants.find(c => c.instanceId === instanceId);
    if (combatant) {
        combatant.currentWounds = parseInt(value);
        renderCombatants(); // Re-render to update colors
    }
}

// --- Standard NPC Management Functions (Same as before) ---


function openModal(npc = null) {
    const modal = document.getElementById('npcModal');
    const form = document.getElementById('npcForm');
    const title = document.getElementById('modalTitle');

    if (npc) {
        title.innerText = 'Modifica PNG';
        document.getElementById('npcId').value = npc.id;
        document.getElementById('name').value = npc.name;
        document.getElementById('traits').value = npc.traits || '';
        document.getElementById('description').value = npc.description || '';

        // Stats
        ['ws', 'bs', 's', 't', 'ag', 'int', 'wp', 'fel', 'a', 'w', 'm', 'mag', 'ip', 'fp', 'armor_head', 'armor_arms', 'armor_body', 'armor_legs'].forEach(stat => {
            document.getElementById(stat).value = npc[stat] || '';
        });

        // Text areas (except skills and talents)
        ['special_rules', 'armor', 'weapons', 'equipment'].forEach(field => {
            document.getElementById(field).value = npc[field] || '';
        });

        // Load skills as tags
        selectedSkills = npc.skills ? npc.skills.split(',').map(s => s.trim()).filter(s => s) : [];
        renderSkillTags();

        // Load talents as tags
        selectedTalents = npc.talents ? npc.talents.split(',').map(t => t.trim()).filter(t => t) : [];
        renderTalentTags();
    } else {
        title.innerText = 'Nuovo PNG';
        form.reset();
        document.getElementById('npcId').value = '';
        selectedSkills = [];
        selectedTalents = [];
        renderSkillTags();
        renderTalentTags();
    }

    // Clear combatant instance ID if not explicitly set (handled by editCombatant)
    if (!npc || !npc.instanceId) {
        document.getElementById('combatantInstanceId').value = '';
        document.getElementById('mutationControls').style.display = 'none';
    }

    modal.style.display = 'block';
}


function editCombatant(instanceId) {
    const combatant = combatants.find(c => c.instanceId === instanceId);
    if (combatant) {
        openModal(combatant);
        document.getElementById('modalTitle').innerText = 'Modifica Combattente (Temporaneo)';
        document.getElementById('combatantInstanceId').value = instanceId;
        document.getElementById('mutationControls').style.display = 'block';
    }
}

function closeModal() {
    document.getElementById('npcModal').style.display = 'none';
}

function editNPC(id) {
    const npc = npcs.find(n => n.id === id);
    if (npc) {
        openModal(npc);
    }
}

async function deleteNPC(id) {
    if (!confirm('Sei sicuro di voler eliminare questo PNG?')) return;

    try {
        const response = await fetch(`/api/npcs/${id}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
            loadNPCs();
        }
    } catch (e) {
        console.error('Error deleting NPC:', e);
    }
}


async function saveNPC(event) {
    event.preventDefault();

    const id = document.getElementById('npcId').value;
    const instanceId = document.getElementById('combatantInstanceId').value;

    const formData = {
        name: document.getElementById('name').value,
        traits: document.getElementById('traits').value,
        description: document.getElementById('description').value,
    };

    // Collect stats
    ['ws', 'bs', 's', 't', 'ag', 'int', 'wp', 'fel', 'a', 'w', 'm', 'mag', 'ip', 'fp', 'armor_head', 'armor_arms', 'armor_body', 'armor_legs'].forEach(stat => {
        const val = document.getElementById(stat).value;
        formData[stat] = val ? parseInt(val) : null;
    });

    // Collect text areas (except skills)
    ['special_rules', 'armor', 'weapons', 'equipment'].forEach(field => {
        formData[field] = document.getElementById(field).value;
    });

    // Serialize skills
    formData.skills = selectedSkills.join(', ');
    formData.talents = selectedTalents.join(', ');

    // Check if it's a modified NPC
    const baseNpcId = document.getElementById('baseNpcId') ? document.getElementById('baseNpcId').value : '';
    const modifiedNpcId = document.getElementById('modifiedNpcId') ? document.getElementById('modifiedNpcId').value : '';

    if (baseNpcId || modifiedNpcId) {
        // Save as modified NPC
        formData.base_npc_id = baseNpcId ? parseInt(baseNpcId) : null;

        const method = modifiedNpcId ? 'PUT' : 'POST';
        const url = modifiedNpcId ? `/api/modified_npcs/${modifiedNpcId}` : '/api/modified_npcs';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            if (data.success) {
                closeModal();
                loadModifiedNPCs();
                // Clear hidden fields
                if (document.getElementById('baseNpcId')) document.getElementById('baseNpcId').value = '';
                if (document.getElementById('modifiedNpcId')) document.getElementById('modifiedNpcId').value = '';
            }
        } catch (e) {
            console.error('Error saving modified NPC:', e);
            alert('Errore nel salvataggio');
        }
        return;
    }

    // If it's a combatant instance, update local state only
    if (instanceId) {
        const combatantIndex = combatants.findIndex(c => c.instanceId == instanceId);
        if (combatantIndex !== -1) {
            // Preserve instanceId and currentWounds
            const original = combatants[combatantIndex];
            combatants[combatantIndex] = {
                ...formData,
                instanceId: original.instanceId,
                currentWounds: original.currentWounds
            };
            sortCombatants();
            closeModal();
        }
        return;
    }

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/npcs/${id}` : '/api/npcs';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const data = await response.json();

        if (data.success) {
            closeModal();
            loadNPCs();
        } else {
            alert('Errore nel salvataggio');
        }
    } catch (e) {
        console.error('Error saving NPC:', e);
        alert('Errore nel salvataggio');
    }
}

window.onclick = function (event) {
    const modal = document.getElementById('npcModal');
    if (event.target == modal) {
        closeModal();
    }
}


function filterNPCTable() {
    const nameFilter = document.getElementById('searchName').value.toLowerCase();
    const skillFilter = document.getElementById('searchSkill').value.toLowerCase();
    const talentFilter = document.getElementById('searchTalent').value.toLowerCase();

    const tbody = document.getElementById('npcTableBody');
    const rows = tbody.getElementsByTagName('tr');
    const emptyDiv = document.getElementById('npcTableEmpty');
    const table = document.getElementById('npcTable');

    let visibleCount = 0;

    for (let row of rows) {
        const name = row.dataset.npcName || '';
        const skills = row.dataset.npcSkills || '';
        const talents = row.dataset.npcTalents || '';

        const matchName = !nameFilter || name.includes(nameFilter);
        const matchSkill = !skillFilter || skills.includes(skillFilter);
        const matchTalent = !talentFilter || talents.includes(talentFilter);

        if (matchName && matchSkill && matchTalent) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    }

    if (visibleCount === 0) {
        table.style.display = 'none';
        emptyDiv.style.display = 'block';
        emptyDiv.textContent = 'Nessun PNG corrisponde ai criteri di ricerca.';
    } else {
        table.style.display = 'table';
        emptyDiv.style.display = 'none';
    }
}

function clearNPCFilters() {
    document.getElementById('searchName').value = '';
    document.getElementById('searchSkill').value = '';
    document.getElementById('searchTalent').value = '';
    filterNPCTable();
}

// --- END NPC TABLE FUNCTIONS ---


function filterNPCTable() {
    const nameFilter = document.getElementById('searchName').value.toLowerCase();
    const skillFilter = document.getElementById('searchSkill').value.toLowerCase();
    const talentFilter = document.getElementById('searchTalent').value.toLowerCase();

    const tbody = document.getElementById('npcTableBody');
    const rows = tbody.getElementsByTagName('tr');
    const emptyDiv = document.getElementById('npcTableEmpty');
    const table = document.getElementById('npcTable');

    let visibleCount = 0;

    for (let row of rows) {
        const name = row.dataset.npcName || '';
        const skills = row.dataset.npcSkills || '';
        const talents = row.dataset.npcTalents || '';

        const matchName = !nameFilter || name.includes(nameFilter);
        const matchSkill = !skillFilter || skills.includes(skillFilter);
        const matchTalent = !talentFilter || talents.includes(talentFilter);

        if (matchName && matchSkill && matchTalent) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    }

    if (visibleCount === 0) {
        table.style.display = 'none';
        emptyDiv.style.display = 'block';
        emptyDiv.textContent = 'Nessun PNG corrisponde ai criteri di ricerca.';
    } else {
        table.style.display = 'table';
        emptyDiv.style.display = 'none';
    }
}

function clearNPCFilters() {
    document.getElementById('searchName').value = '';
    document.getElementById('searchSkill').value = '';
    document.getElementById('searchTalent').value = '';
    filterNPCTable();
}

// --- END NPC TABLE FUNCTIONS ---


// --- PLAYER CHARACTER (PG) FUNCTIONS ---

let playerCharacters = [];

async function loadPlayerCharacters() {
    try {
        const response = await fetch('/api/player_characters');
        const data = await response.json();
        if (data.success) {
            playerCharacters = data.player_characters;
            renderPlayerCharacters();
        }
    } catch (e) {
        console.error('Error loading player characters:', e);
    }
}

function renderPlayerCharacters() {
    const container = document.getElementById('pgList');
    if (!container) return;
    container.innerHTML = '';

    if (playerCharacters.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 2rem;">Nessun PG inserito. Aggiungi i tuoi personaggi giocanti.</div>';
        return;
    }

    playerCharacters.forEach(pg => {
        const card = document.createElement('div');
        card.className = 'npc-card';
        card.style.borderColor = '#007bff'; // Blue border for PGs

        card.innerHTML = `
                <div class="npc-name">
                    ${pg.name}
                </div>
                <div class="npc-stats">
                    <div class="stat-box"><div class="stat-label">AC</div><div class="stat-value">${pg.ws || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">AB</div><div class="stat-value">${pg.bs || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">F</div><div class="stat-value">${pg.s || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">R</div><div class="stat-value">${pg.t || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">Ag</div><div class="stat-value">${pg.ag || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">Int</div><div class="stat-value">${pg.int || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">Vol</div><div class="stat-value">${pg.wp || '-'}</div></div>
                    <div class="stat-box"><div class="stat-label">Sim</div><div class="stat-value">${pg.fel || '-'}</div></div>
                </div>
                <div class="secondary-stats">
                    <span><strong>A:</strong> ${pg.a || '-'}</span>
                    <span><strong>Fe:</strong> ${pg.w || '-'}</span>
                    <span><strong>M:</strong> ${pg.m || '-'}</span>
                </div>
                <div class="secondary-stats">
                    <span><strong>Armatura:</strong> T:${pg.armor_head || 0} B:${pg.armor_arms || 0} C:${pg.armor_body || 0} G:${pg.armor_legs || 0}</span>
                </div>
                ${pg.description ? `<div style="font-size: 0.8rem; color: #aaa; margin-top: 0.5rem;">${pg.description}</div>` : ''}
                <div class="npc-actions">
                    <button class="btn btn-add" onclick="addPGToCombat(${pg.id})">Aggiungi al Combattimento</button>
                    <button class="btn btn-edit" onclick="editPG(${pg.id})">Modifica</button>
                    <button class="btn btn-danger" onclick="deletePG(${pg.id})">Elimina</button>
                </div>
            `;
        container.appendChild(card);
    });
}

function openPGModal() {
    const modal = document.getElementById('pgModal');
    const form = document.getElementById('pgForm');
    const title = document.getElementById('pgModalTitle');

    title.innerText = 'Nuovo PG';
    form.reset();
    document.getElementById('pgId').value = '';

    modal.style.display = 'block';
}

function closePGModal() {
    document.getElementById('pgModal').style.display = 'none';
}

function editPG(id) {
    const pg = playerCharacters.find(p => p.id === id);
    if (!pg) return;

    const modal = document.getElementById('pgModal');
    const title = document.getElementById('pgModalTitle');

    title.innerText = 'Modifica PG';

    document.getElementById('pgId').value = pg.id;
    document.getElementById('pgName').value = pg.name;
    document.getElementById('pgDescription').value = pg.description || '';

    ['ws', 'bs', 's', 't', 'ag', 'int', 'wp', 'fel', 'a', 'w', 'm'].forEach(stat => {
        document.getElementById('pg' + stat.charAt(0).toUpperCase() + stat.slice(1)).value = pg[stat] || '';
    });

    document.getElementById('pgArmorHead').value = pg.armor_head || '';
    document.getElementById('pgArmorArms').value = pg.armor_arms || '';
    document.getElementById('pgArmorBody').value = pg.armor_body || '';
    document.getElementById('pgArmorLegs').value = pg.armor_legs || '';

    modal.style.display = 'block';
}

async function savePG(event) {
    event.preventDefault();

    const id = document.getElementById('pgId').value;
    const pgData = {
        name: document.getElementById('pgName').value,
        description: document.getElementById('pgDescription').value,
        ws: document.getElementById('pgWs').value || null,
        bs: document.getElementById('pgBs').value || null,
        s: document.getElementById('pgS').value || null,
        t: document.getElementById('pgT').value || null,
        ag: document.getElementById('pgAg').value || null,
        int: document.getElementById('pgInt').value || null,
        wp: document.getElementById('pgWp').value || null,
        fel: document.getElementById('pgFel').value || null,
        a: document.getElementById('pgA').value || null,
        w: document.getElementById('pgW').value || null,
        m: document.getElementById('pgM').value || null,
        armor_head: document.getElementById('pgArmorHead').value || null,
        armor_arms: document.getElementById('pgArmorArms').value || null,
        armor_body: document.getElementById('pgArmorBody').value || null,
        armor_legs: document.getElementById('pgArmorLegs').value || null
    };

    try {
        let response;
        if (id) {
            response = await fetch(`/api/player_characters/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pgData)
            });
        } else {
            response = await fetch('/api/player_characters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pgData)
            });
        }

        const data = await response.json();
        if (data.success) {
            closePGModal();
            loadPlayerCharacters();
        }
    } catch (e) {
        console.error('Error saving PG:', e);
        alert('Errore nel salvataggio del PG');
    }
}

async function deletePG(id) {
    if (!confirm('Sei sicuro di voler eliminare questo PG?')) return;

    try {
        const response = await fetch(`/api/player_characters/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (data.success) {
            loadPlayerCharacters();
        }
    } catch (e) {
        console.error('Error deleting PG:', e);
    }
}

// Critical Hit and Death handlers
function handleCriticalHit(instanceId) {

    const criticalEffects = {
        "head": [
            "Disoriented by the blow. Character can only take a half action on his next turn.",
            "Ears bashed causing ears to ring and head to spin. Character cannot take any actions for 1 round.",
            "The blow inflicts a nasty scalp wound. Blood runs into eyes, causing character to suffer a –10% WS penalty until medical attention is received.",
            "Armour damaged. Armour Points on this location are reduced by 1 until the armour is repaired with a successful Trade (Armourer) Skill Test. If character isn’t wearing any armour or players are using the Basic Armour system, use the #2 result instead.",
            "Knocked to the ground and dazed. All his tests and attacks suffer a –30% penalty for one round and he must use the stand action to regain his feet.",
            "Stunned for 1d10 rounds.",
            "Knocked out for 1d10 minutes. Use the Sudden Death rules for any further Critical Hits on this character.",
            "Face shattered and knocked to the ground. Character is now considered helpless. Blood loss is such that the victim has a 20% chance of dying each round until medical attention is received. Test at the start of his turn each round. Use the Sudden Death rules for any further Critical Hits on this character.",
            "Skull pierced by a mighty blow. Death is instantaneous.",
            "Killed in whatever spectacular and gore-drenched fashion the player or GM cares to describe."
        ],
        "arms": [
            "Drops anything held in that hand. A shield, if worn, is not affected, since it’s strapped on.",
            "Arm struck numb and cannot be used for 1 round.",
            "Hand incapacitated until medical attention is received. Anything held in this hand is dropped(again, excepting a shield).",
            "Armour damaged. Armour Points on this location are reduced by 1 until the armour is repaired with a successful Trade(Armourer) Skill Test.If character isn’t wearing any armour or players are using the Basic Armour system, Arm struck numb and cannot be used for 1 round.",
            "Arm incapacitated until medical attention is received. Anything held in this hand is dropped (excepting a shield).",
            "Arm demolished by attack. Anything held in this hand is dropped(excepting a shield).Blood loss is such that character has a 20 % chance of dying each round until medical attention is received.Test at the start of victim’s turn each round.Use the Sudden Death rules for any further Critical Hits on this opponent.",
            "Hand turned into a bloody ruin. Anything held in this hand is dropped (excepting a shield). Blood loss is such that character has a 20% chance of dying each round until medical attention is received. Test at the start of victim’s turn each round. Use the Sudden Death rules for any further Critical Hits on this opponent. If he survives this combat, he must make a successful Toughness Test or lose the hand permanently.",
            "Arm is now a dangling mass of bloody meat. Anything held in this hand is dropped(excepting a shield).Blood loss is such that character has a 20 % chance of dying each round until medical attention is received.Test at the start of victim’s turn each round.Use the Sudden Death rules for any further Critical Hits on this opponent.If he survives this combat, he must make a successful Toughness Test or lose the arm from the elbow down permanently",
            "Major artery severed. After a fraction of a second, character collapses with blood pouring out of the ruins of his shoulder.Death from shock and blood loss is almost instantaneous.",
            "Killed in whatever spectacular and gore-drenched fashion the player or GM cares to describe."
        ],
        "body": [
            "The wind is knocked out of the character. All tests and attacks suffer a –20% penalty for one round.",
            "Struck in the groin. The pain is such that the character cannot take any actions for one round.",
            "Ribs busted by ferocity of attack. Character takes a –10% AC penalty until medical attention is received.",
            "Armour damaged. Armour Points on this location are reduced by 1 until the armour is repaired with a successful Trade(Armourer) Skill Test.If character isn’t wearing any armour or players are using the Basic Armour system, use the #2 result instead",
            "Knocked to the ground and badly winded. All his tests and attacks suffer a –30% penalty for one round and he must use the stand action to regain his feet.",
            "Stunned for 1d10 rounds",
            "The blow results in serious internal bleeding and the character is helpless.Blood loss is such that the victim has a 20 % chance of dying each round until medical attention is received.Test at the start of his turn each round.Use the Sudden Death rules for any further Critical Hits on this opponent.",
            "Spine pulverized and character is knocked to the ground.Character may do nothing until medical attention is received and is considered helpless.Use the Sudden Death rules for any further Critical Hits on this opponent.If he survives this combat,he must make a successful Toughness Test or become permanently paralyzed from the waist down.",
            "Several internal organs are ruptured by the violence of the blow causing death in a matter of seconds.",
            "Killed in whatever spectacular and gore-drenched fashion the player or GM cares to describe."
        ],
        "legs": [
            "Stumbles. Character can only take a half action on his next turn.",
            "Leg struck numb by the attack. Character’s Movement Characteristic is reduced to 1 for one round and during that time he cannot dodge and suffers a –20% penalty on related Agility Tests.",
            "Leg incapacitated until medical attention is received. Character’s Movement Characteristic is reduced to 1 and he cannot dodge. Related Agility Tests also suffer a –20 % penalty.",
            "Armour damaged. Armour Points on this location are reduced by 1 until the armour is repaired with a successful Trade (Armourer) Skill Test. If character isn’t wearing any armour or players are using the Basic Armour system, use the #2 result instead.",
            "Knocked to the ground and dazed. All character’s tests and attacks suffer a –30 % penalty for one round and he must use the stand action to regain his feet.",
            "Leg demolished and character is considered helpless. Blood loss is such that the victim has a 20% chance of dying each round until medical attention is received. Test at the start of his turn each round. Use the Sudden Death rules for any further Critical Hits on this character.",
            "Leg is turned into a bloody ruin and character is considered helpless. Blood loss is such that the victim has a 20 % chance of dying each round until medical attention is received.Test at the start of his turn each round.Use the Sudden Death rules for any further Critical Hits on this character.If he survives this combat, he must make a successful Toughness Test or lose the foot permanently",
            "Leg turned into a dangling mass of bloody meat and character is considered helpless.Blood loss is such that the victim has a 20 % chance of dying each round until medical attention is received.Test at the start of his turn each round.Use the Sudden Death rules for any further Critical Hits on this character.If he survives this combat, he must make a successful Toughness Test or lose the leg from the knee down permanently.",
            "Major artery severed. After a fraction of a second, character collapses with blood pouring out of the ruins of his leg. Death from shock and blood loss is almost instantaneous.",
            "Killed in whatever spectacular and gore-drenched fashion the player or GM cares to describe."
        ]
    };
    const combatant = combatants.find(c => c.instanceId === instanceId);
    if (combatant) {
        const d100 = Math.floor(Math.random() * 100) + 1;

        // Hash map con chiavi tupla (range) e valori array di 10 interi
        const criticalHitTable = new Map();
        criticalHitTable.set('1-10', [5, 7, 9, 10, 10, 10, 10, 10, 10, 10]);
        criticalHitTable.set('11-20', [5, 6, 8, 9, 10, 10, 10, 10, 10, 10]);
        criticalHitTable.set('21-30', [4, 6, 8, 9, 9, 10, 10, 10, 10, 10]);
        criticalHitTable.set('31-40', [4, 5, 7, 8, 9, 9, 10, 10, 10, 10]);
        criticalHitTable.set('41-50', [3, 5, 7, 8, 8, 9, 9, 10, 10, 10]);
        criticalHitTable.set('51-60', [3, 4, 6, 7, 8, 8, 9, 9, 10, 10]);
        criticalHitTable.set('61-70', [2, 4, 6, 7, 7, 8, 8, 9, 9, 9]);
        criticalHitTable.set('71-80', [2, 3, 5, 6, 7, 7, 8, 8, 9, 9]);
        criticalHitTable.set('81-90', [1, 3, 5, 6, 6, 7, 7, 8, 8, 9]);
        criticalHitTable.set('91-100', [1, 2, 4, 5, 6, 6, 7, 7, 8, 8]);

        // Determina quale array selezionare in base al d100
        let selectedRange = '';
        let selectedArray = null;

        if (d100 >= 1 && d100 <= 10) {
            selectedRange = '1-10';
        } else if (d100 >= 11 && d100 <= 20) {
            selectedRange = '11-20';
        } else if (d100 >= 21 && d100 <= 30) {
            selectedRange = '21-30';
        } else if (d100 >= 31 && d100 <= 40) {
            selectedRange = '31-40';
        } else if (d100 >= 41 && d100 <= 50) {
            selectedRange = '41-50';
        } else if (d100 >= 51 && d100 <= 60) {
            selectedRange = '51-60';
        } else if (d100 >= 61 && d100 <= 70) {
            selectedRange = '61-70';
        } else if (d100 >= 71 && d100 <= 80) {
            selectedRange = '71-80';
        } else if (d100 >= 81 && d100 <= 90) {
            selectedRange = '81-90';
        } else if (d100 >= 91 && d100 <= 100) {
            selectedRange = '91-100';
        }

        selectedArray = criticalHitTable.get(selectedRange);

        console.log('Critical hit for combatant:', instanceId);
        console.log('Ferite attuali:', combatant.currentWounds);
        console.log('Tiro d100:', d100);
        console.log('Range selezionato:', selectedRange);
        console.log('Array selezionato:', selectedArray);
        // TODO: Select specific value from array based on wounds
        const wounds = combatant.currentWounds;
        const criticalHitValue = selectedArray[(wounds * -1) - 1];
        console.log('Valore critico:', criticalHitValue);
        // Mostra modal con tutti gli effetti critici per ogni locazione
        const headEffect = criticalEffects['head'][criticalHitValue - 1];
        const armsEffect = criticalEffects['arms'][criticalHitValue - 1];
        const bodyEffect = criticalEffects['body'][criticalHitValue - 1];
        const legsEffect = criticalEffects['legs'][criticalHitValue - 1];
        
        // Popola il contenuto del modal
        const modalContent = document.getElementById('criticalHitContent');
        modalContent.innerHTML = `
            <div style="background: #1a1a1a; padding: 1rem; border-radius: 4px; margin-bottom: 1rem; border-left: 4px solid #ffd700;">
                <div style="color: #ffd700; font-weight: bold; margin-bottom: 0.5rem;">
                    Tiro d100: ${d100} | Valore Critico: ${criticalHitValue}
                </div>
            </div>
            
            <div style="background: #2a1a1a; padding: 1rem; border-radius: 4px; margin-bottom: 1rem; border-left: 4px solid #ff4444;">
                <div style="color: #ff4444; font-weight: bold; margin-bottom: 0.5rem; font-size: 1.1rem;">
                    🎯 TESTA
                </div>
                <div style="color: #ddd; line-height: 1.6;">
                    ${headEffect}
                </div>
            </div>
            
            <div style="background: #2a1a1a; padding: 1rem; border-radius: 4px; margin-bottom: 1rem; border-left: 4px solid #4488ff;">
                <div style="color: #4488ff; font-weight: bold; margin-bottom: 0.5rem; font-size: 1.1rem;">
                    💪 BRACCIA
                </div>
                <div style="color: #ddd; line-height: 1.6;">
                    ${armsEffect}
                </div>
            </div>
            
            <div style="background: #2a1a1a; padding: 1rem; border-radius: 4px; margin-bottom: 1rem; border-left: 4px solid #44ff44;">
                <div style="color: #44ff44; font-weight: bold; margin-bottom: 0.5rem; font-size: 1.1rem;">
                    🫀 CORPO
                </div>
                <div style="color: #ddd; line-height: 1.6;">
                    ${bodyEffect}
                </div>
            </div>
            
            <div style="background: #2a1a1a; padding: 1rem; border-radius: 4px; margin-bottom: 1rem; border-left: 4px solid #ffaa44;">
                <div style="color: #ffaa44; font-weight: bold; margin-bottom: 0.5rem; font-size: 1.1rem;">
                    🦵 GAMBE
                </div>
                <div style="color: #ddd; line-height: 1.6;">
                    ${legsEffect}
                </div>
            </div>
        `;
        
        // Mostra il modal
        document.getElementById('criticalHitModal').style.display = 'block';
    } else {
        console.error('Combatant not found:', instanceId);
    }
}

// Dead combatants list
let deadCombatants = [];

function handleDeath(instanceId) {
    const combatant = combatants.find(c => c.instanceId === instanceId);
    if (!combatant) {
        console.error('Combatant not found:', instanceId);
        return;
    }
    
    // Confirm death
    if (!confirm(`Confermi la morte di ${combatant.name}?`)) {
        return;
    }
    
    // Add to dead list
    deadCombatants.push({
        name: combatant.name,
        timestamp: new Date().toLocaleTimeString()
    });
    
    // Remove from active combatants
    combatants = combatants.filter(c => c.instanceId !== instanceId);
    
    // Re-render both lists
    renderCombatants();
    renderDeadList();
}

function renderDeadList() {
    const container = document.getElementById('deadList');
    if (!container) return;
    
    if (deadCombatants.length === 0) {
        container.innerHTML = '<div style="color: #666; font-style: italic;">Nessun caduto</div>';
        return;
    }
    
    container.innerHTML = deadCombatants.map(dead => `
        <div style="background: #2a2a2a; border: 1px solid #444; border-radius: 4px; padding: 0.5rem 1rem; display: inline-flex; align-items: center; gap: 0.5rem;">
            <span style="color: #666;">💀</span>
            <span style="color: #999;">${dead.name}</span>
            <span style="color: #555; font-size: 0.8rem;">(${dead.timestamp})</span>
        </div>
    `).join('');
}

function clearDeadList() {
    if (deadCombatants.length === 0) return;
    
    if (confirm('Svuotare la lista dei caduti?')) {
        deadCombatants = [];
        renderDeadList();
    }
}

function addPGToCombat(pgId) {
    const pg = playerCharacters.find(p => p.id === pgId);
    if (!pg) return;

    const ag = pg.ag || 0;
    const d10 = Math.floor(Math.random() * 10) + 1;
    const initiative = ag + d10;

    const combatant = {
        ...JSON.parse(JSON.stringify(pg)),
        instanceId: Date.now() + Math.random(),
        currentWounds: pg.w || 0,
        isPG: true,
        initiative: initiative,
        initiativeRoll: d10
    };

    combatants.push(combatant);
    sortCombatants();
}


// Close critical hit modal
function closeCriticalHitModal() {
    document.getElementById('criticalHitModal').style.display = 'none';
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('criticalHitModal');
    if (event.target === modal) {
        closeCriticalHitModal();
    }
});

// --- END PLAYER CHARACTER FUNCTIONS ---