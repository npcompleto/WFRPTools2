document.addEventListener('DOMContentLoaded', () => {
        loadSkills();
        loadTalents();
        loadMutations();
        loadCareers();
    });

    function openTab(tabName) {
        // Hide all tab content
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        // Deactivate all buttons
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));

        // Show specific tab content
        document.getElementById(tabName).classList.add('active');
        // Activate specific button
        const buttons = document.querySelectorAll('.tab-button');
        buttons.forEach(btn => {
            if (btn.getAttribute('onclick').includes(tabName)) {
                btn.classList.add('active');
            }
        });
    }


    // --- CAREERS ---

    async function loadCareers() {
        try {
            const response = await fetch('/api/careers');
            const data = await response.json();
            if (data.success) {
                careersData = data.careers;
                renderCareers(careersData);
            }
        } catch (e) {
            console.error('Error loading careers:', e);
        }
    }

    function renderCareers(careers) {
        const tbody = document.getElementById('careersList');
        tbody.innerHTML = '';
        careers.forEach(career => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${career.name}</td>
                <td>${career.description || '-'}</td>
                <td>
                    <button class="btn btn-edit" onclick="editCareer(${career.id})" style="background: #007bff; color: #fff; margin-right: 5px;">Modifica</button>
                    <button class="btn btn-danger" onclick="deleteCareer(${career.id})">Elimina</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function openCareerModal() {
        document.getElementById('careerForm').reset();
        document.getElementById('careerId').value = '';
        document.getElementById('careerModalTitle').innerText = 'Nuova Carriera';

        careerSelectedSkills = [];
        careerSelectedTalents = [];
        setupCareerTagInputs();
        renderCareerSkillTags();
        renderCareerTalentTags();

        document.getElementById('careerModal').style.display = 'block';
    }

    function editCareer(id) {
        const career = careersData.find(c => c.id === id);
        if (career) {
            document.getElementById('careerId').value = career.id;
            document.getElementById('careerName').value = career.name;
            document.getElementById('careerDescription').value = career.description || '';

            ['ws', 'bs', 's', 't', 'ag', 'int', 'wp', 'fel', 'a', 'w', 'm', 'mag', 'ip', 'fp'].forEach(stat => {
                document.getElementById('c_' + stat).value = career[stat] || '';
            });

            document.getElementById('careerTrappings').value = career.trappings || '';
            document.getElementById('careerExits').value = career.career_exits || '';

            careerSelectedSkills = career.skills ? career.skills.split(',').map(s => s.trim()).filter(s => s) : [];
            careerSelectedTalents = career.talents ? career.talents.split(',').map(s => s.trim()).filter(s => s) : [];
            setupCareerTagInputs()
            renderCareerSkillTags();
            renderCareerTalentTags();

            document.getElementById('careerModalTitle').innerText = 'Modifica Carriera';
            document.getElementById('careerModal').style.display = 'block';
        }
    }

    function closeCareerModal() {
        document.getElementById('careerModal').style.display = 'none';
    }

    async function saveCareer(event) {
        event.preventDefault();
        const id = document.getElementById('careerId').value;
        const formData = {
            name: document.getElementById('careerName').value,
            description: document.getElementById('careerDescription').value,
            trappings: document.getElementById('careerTrappings').value,
            career_exits: document.getElementById('careerExits').value,
            skills: careerSelectedSkills.join(', '),
            talents: careerSelectedTalents.join(', ')
        };

        ['ws', 'bs', 's', 't', 'ag', 'int', 'wp', 'fel', 'a', 'w', 'm', 'mag', 'ip', 'fp'].forEach(stat => {
            const val = document.getElementById('c_' + stat).value;
            formData[stat] = val ? parseInt(val) : null;
        });

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/careers/${id}` : '/api/careers';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            if (data.success) {
                closeCareerModal();
                loadCareers();
            }
        } catch (e) {
            console.error('Error saving career:', e);
        }
    }

    async function deleteCareer(id) {
        if (!confirm('Sei sicuro di voler eliminare questa carriera?')) return;
        try {
            const response = await fetch(`/api/careers/${id}`, { method: 'DELETE' });
            if ((await response.json()).success) {
                loadCareers();
            }
        } catch (e) {
            console.error('Error deleting career:', e);
        }
    }

    // --- TAG INPUT LOGIC FOR CAREERS ---

    function setupCareerTagInputs() {
        // Skills
        const skillInput = document.getElementById('careerSkillInput');
        const skillSuggestions = document.getElementById('careerSkillSuggestions');

        skillInput.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase();
            if (value.length < 2) {
                skillSuggestions.style.display = 'none';
                return;
            }
            const filtered = skillsData.filter(s => s.name.toLowerCase().includes(value));
            if (filtered.length > 0) {
                skillSuggestions.innerHTML = filtered.map(s => {
                    const escapedName = s.name.replace(/'/g, "\\'");
                    return `<li data-name="${s.name}" onclick="addCareerSkill('${escapedName}')">${s.name}</li>`;
                }).join('');
                skillSuggestions.style.display = 'block';
            } else {
                skillSuggestions.style.display = 'none';
            }
        });

        // Talents
        const talentInput = document.getElementById('careerTalentInput');
        const talentSuggestions = document.getElementById('careerTalentSuggestions');

        talentInput.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase();
            if (value.length < 2) {
                talentSuggestions.style.display = 'none';
                return;
            }
            const filtered = talentsData.filter(t => t.name.toLowerCase().includes(value));
            if (filtered.length > 0) {
                talentSuggestions.innerHTML = filtered.map(t => {
                    const escapedName = t.name.replace(/'/g, "\\'");
                    return `<li data-name="${t.name}" onclick="addCareerTalent('${escapedName}')">${t.name}</li>`;
                }).join('');
                talentSuggestions.style.display = 'block';
            } else {
                talentSuggestions.style.display = 'none';
            }
        });

        // Hide suggestions on click outside
        document.addEventListener('click', (e) => {
            if (e.target !== skillInput) skillSuggestions.style.display = 'none';
            if (e.target !== talentInput) talentSuggestions.style.display = 'none';
        });
    }

    function addCareerSkill(name) {
        if (name.includes('(varie)')) {
            const replacement = prompt('Questa abilità contiene "(varie)". Inserisci il testo da sostituire a "varie":', '');
            if (replacement === null || replacement.trim() === '') return;
            name = name.replace('(varie)', `(${replacement.trim()})`);
        }
        careerSelectedSkills.push(name);
        renderCareerSkillTags();
        document.getElementById('careerSkillInput').value = '';
        document.getElementById('careerSkillSuggestions').style.display = 'none';
    }

    function removeCareerSkill(name) {
        careerSelectedSkills = careerSelectedSkills.filter(s => s !== name);
        renderCareerSkillTags();
    }

    function renderCareerSkillTags() {
        const container = document.getElementById('careerSkillsContainer');
        container.innerHTML = careerSelectedSkills.map(name => {
            let skill = skillsData.find(s => s.name === name);
            if (!skill && name.includes('(') && name.includes(')')) {
                const baseName = name.replace(/\([^)]+\)/, '(varie)');
                skill = skillsData.find(s => s.name === baseName);
            }
            const tooltip = skill ? `<div class="tooltip-content"><strong>${skill.name}</strong><br>${skill.description || ''}</div>` : '';
            return `<span class="tag">${name}<span class="tag-remove" onclick="removeCareerSkill('${name}')">&times;</span>${tooltip}</span>`;
        }).join('');
    }

    function addCareerTalent(name) {
        if (name.includes('(varie)')) {
            const replacement = prompt('Questo talento contiene "(varie)". Inserisci il testo da sostituire a "varie":', '');
            if (replacement === null || replacement.trim() === '') return;
            name = name.replace('(varie)', `(${replacement.trim()})`);
        }
        careerSelectedTalents.push(name);
        renderCareerTalentTags();
        document.getElementById('careerTalentInput').value = '';
        document.getElementById('careerTalentSuggestions').style.display = 'none';
    }

    function removeCareerTalent(name) {
        careerSelectedTalents = careerSelectedTalents.filter(t => t !== name);
        renderCareerTalentTags();
    }

    function renderCareerTalentTags() {
        const container = document.getElementById('careerTalentsContainer');
        container.innerHTML = careerSelectedTalents.map(name => {
            let talent = talentsData.find(t => t.name === name);
            if (!talent && name.includes('(') && name.includes(')')) {
                const baseName = name.replace(/\([^)]+\)/, '(varie)');
                talent = talentsData.find(t => t.name === baseName);
            }
            const tooltip = talent ? `<div class="tooltip-content"><strong>${talent.name}</strong><br>${talent.description || ''}</div>` : '';
            return `<span class="tag">${name}<span class="tag-remove" onclick="removeCareerTalent('${name}')">&times;</span>${tooltip}</span>`;
        }).join('');
    }

    // --- SKILLS ---

    async function loadSkills() {
        try {
            const response = await fetch('/api/skills');
            const data = await response.json();
            if (data.success) {
                skillsData = data.skills;
                renderSkills(skillsData);
            }
        } catch (e) {
            console.error('Error loading skills:', e);
        }
    }

    function renderSkills(skills) {
        const tbody = document.getElementById('skillsList');
        tbody.innerHTML = '';
        skills.forEach(skill => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${skill.name}</td>
                <td>${skill.characteristic || '-'}</td>
                <td>${skill.type || '-'}</td>
                <td>${skill.description || '-'}</td>
                <td>
                    <button class="btn btn-edit" onclick="editSkill(${skill.id})" style="background: #007bff; color: #fff; margin-right: 5px;">Modifica</button>
                    <button class="btn btn-danger" onclick="deleteSkill(${skill.id})">Elimina</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function openSkillModal() {
        document.getElementById('skillForm').reset();
        document.getElementById('skillId').value = '';
        document.getElementById('skillModalTitle').innerText = 'Nuova Abilità';
        document.getElementById('skillModal').style.display = 'block';
    }

    function editSkill(id) {
        const skill = skillsData.find(s => s.id === id);
        if (skill) {
            document.getElementById('skillId').value = skill.id;
            document.getElementById('skillName').value = skill.name;
            document.getElementById('skillCharacteristic').value = skill.characteristic || '';
            document.getElementById('skillType').value = skill.type || 'Base';
            document.getElementById('skillDescription').value = skill.description || '';

            document.getElementById('skillModalTitle').innerText = 'Modifica Abilità';
            document.getElementById('skillModal').style.display = 'block';
        }
    }

    function closeSkillModal() {
        document.getElementById('skillModal').style.display = 'none';
    }

    async function saveSkill(event) {
        event.preventDefault();
        const id = document.getElementById('skillId').value;
        const formData = {
            name: document.getElementById('skillName').value,
            characteristic: document.getElementById('skillCharacteristic').value,
            type: document.getElementById('skillType').value,
            description: document.getElementById('skillDescription').value
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/skills/${id}` : '/api/skills';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            if (data.success) {
                closeSkillModal();
                loadSkills();
            }
        } catch (e) {
            console.error('Error saving skill:', e);
        }
    }

    async function deleteSkill(id) {
        if (!confirm('Sei sicuro di voler eliminare questa abilità?')) return;
        try {
            const response = await fetch(`/api/skills/${id}`, { method: 'DELETE' });
            if ((await response.json()).success) {
                loadSkills();
            }
        } catch (e) {
            console.error('Error deleting skill:', e);
        }
    }


    // --- TALENTS ---
    async function loadTalents() {
        try {
            const response = await fetch('/api/talents');
            const data = await response.json();
            if (data.success) {
                talentsData = data.talents;
                renderTalents(talentsData);
            }
        } catch (e) {
            console.error('Error loading talents:', e);
        }
    }

    function renderTalents(talents) {
        const tbody = document.getElementById('talentsList');
        tbody.innerHTML = '';
        talents.forEach(talent => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${talent.name}</td>
                <td>${talent.description || '-'}</td>
                <td>
                    <button class="btn btn-edit" onclick="editTalent(${talent.id})" style="background: #007bff; color: #fff; margin-right: 5px;">Modifica</button>
                    <button class="btn btn-danger" onclick="deleteTalent(${talent.id})">Elimina</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function openTalentModal() {
        document.getElementById('talentForm').reset();
        document.getElementById('talentId').value = '';
        document.getElementById('talentModalTitle').innerText = 'Nuovo Talento';
        document.getElementById('talentModal').style.display = 'block';
    }

    function editTalent(id) {
        const talent = talentsData.find(t => t.id === id);
        if (talent) {
            document.getElementById('talentId').value = talent.id;
            document.getElementById('talentName').value = talent.name;
            document.getElementById('talentDescription').value = talent.description || '';

            document.getElementById('talentModalTitle').innerText = 'Modifica Talento';
            document.getElementById('talentModal').style.display = 'block';
        }
    }

    function closeTalentModal() {
        document.getElementById('talentModal').style.display = 'none';
    }

    async function saveTalent(event) {
        event.preventDefault();
        const id = document.getElementById('talentId').value;
        const formData = {
            name: document.getElementById('talentName').value,
            description: document.getElementById('talentDescription').value
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/talents/${id}` : '/api/talents';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            if (data.success) {
                closeTalentModal();
                loadTalents();
            }
        } catch (e) {
            console.error('Error saving talent:', e);
        }
    }

    async function deleteTalent(id) {
        if (!confirm('Sei sicuro di voler eliminare questo talento?')) return;
        try {
            const response = await fetch(`/api/talents/${id}`, { method: 'DELETE' });
            if ((await response.json()).success) {
                loadTalents();
            }
        } catch (e) {
            console.error('Error deleting talent:', e);
        }
    }

    // --- MUTATIONS ---

    async function loadMutations() {
        try {
            const response = await fetch('/api/chaos_mutations');
            const data = await response.json();
            if (data.success) {
                mutationsData = data.mutations;
                renderMutations(mutationsData);
            }
        } catch (e) {
            console.error('Error loading mutations:', e);
        }
    }

    function renderMutations(mutations) {
        const tbody = document.getElementById('mutationsList');
        tbody.innerHTML = '';
        // Sort by min_dice
        mutations.sort((a, b) => a.min_dice - b.min_dice);

        mutations.forEach(mut => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${mut.min_dice} - ${mut.max_dice}</td>
                <td>${mut.mutation}</td>
                <td>${mut.effect || '-'}</td>
                <td>
                    <button class="btn btn-edit" onclick="editMutation(${mut.id})" style="background: #007bff; color: #fff; margin-right: 5px;">Modifica</button>
                    <button class="btn btn-danger" onclick="deleteMutation(${mut.id})">Elimina</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function openMutationModal() {
        document.getElementById('mutationForm').reset();
        document.getElementById('mutationId').value = '';
        document.getElementById('mutationModalTitle').innerText = 'Nuova Mutazione';
        document.getElementById('mutationModal').style.display = 'block';
    }

    function editMutation(id) {
        const mut = mutationsData.find(m => m.id === id);
        if (mut) {
            document.getElementById('mutationId').value = mut.id;
            document.getElementById('mutMin').value = mut.min_dice;
            document.getElementById('mutMax').value = mut.max_dice;
            document.getElementById('mutName').value = mut.mutation;
            document.getElementById('mutEffect').value = mut.effect || '';

            document.getElementById('mutationModalTitle').innerText = 'Modifica Mutazione';
            document.getElementById('mutationModal').style.display = 'block';
        }
    }

    function closeMutationModal() {
        document.getElementById('mutationModal').style.display = 'none';
    }

    async function saveMutation(event) {
        event.preventDefault();
        const id = document.getElementById('mutationId').value;
        const formData = {
            min_dice: parseInt(document.getElementById('mutMin').value),
            max_dice: parseInt(document.getElementById('mutMax').value),
            mutation: document.getElementById('mutName').value,
            effect: document.getElementById('mutEffect').value
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/chaos_mutations/${id}` : '/api/chaos_mutations';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            if (data.success) {
                closeMutationModal();
                loadMutations();
            }
        } catch (e) {
            console.error('Error saving mutation:', e);
        }
    }

    async function deleteMutation(id) {
        if (!confirm('Sei sicuro di voler eliminare questa mutazione?')) return;
        try {
            const response = await fetch(`/api/chaos_mutations/${id}`, { method: 'DELETE' });
            if ((await response.json()).success) {
                loadMutations();
            }
        } catch (e) {
            console.error('Error deleting mutation:', e);
        }
    }

    window.onclick = function (event) {
        if (event.target == document.getElementById('skillModal')) {
            closeSkillModal();
        }
        if (event.target == document.getElementById('talentModal')) {
            closeTalentModal();
        }
        if (event.target == document.getElementById('careerModal')) {
            closeCareerModal();
        }
        if (event.target == document.getElementById('mutationModal')) {
            closeMutationModal();
        }
    }