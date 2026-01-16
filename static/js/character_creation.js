document.addEventListener('DOMContentLoaded', () => {
    // State
    const state = {
        step: 1,
        race: null,
        stats: null,
        secondaryStats: null,
        career: null,
        name: ''
    };

    // Constants
    const RACES = {
        'Umano': { ws: 20, bs: 20, s: 20, t: 20, ag: 20, int: 20, wp: 20, fel: 20, m: 4, fate: [2, 3] },
        'Elfo': { ws: 20, bs: 30, s: 20, t: 20, ag: 30, int: 20, wp: 20, fel: 20, m: 5, fate: [1, 2] },
        'Nano': { ws: 30, bs: 20, s: 20, t: 30, ag: 10, int: 20, wp: 20, fel: 10, m: 3, fate: [1, 3] },
        'Mezzuomo': { ws: 10, bs: 30, s: 10, t: 10, ag: 30, int: 20, wp: 20, fel: 30, m: 4, fate: [2, 3] }
    };

    // Elements
    const steps = [1, 2, 3, 4].map(i => document.getElementById(`step${i}`));
    const dots = [1, 2, 3, 4].map(i => document.querySelector(`.step-dot[data-step="${i}"]`));

    // Step 1 Elements
    const raceOptions = document.querySelectorAll('.race-options .option-card');
    const step1Next = document.getElementById('step1Next');

    // Step 2 Elements
    const rollStatsBtn = document.getElementById('rollStatsBtn');
    const mainStatsContainer = document.getElementById('mainStats');
    const secondaryStatsContainer = document.getElementById('secondaryStats');
    const selectedRaceDisplay = document.getElementById('selectedRaceDisplay');
    const step2Next = document.getElementById('step2Next');
    const step2Prev = document.getElementById('step2Prev');

    // Step 3 Elements
    const careerSearch = document.getElementById('careerSearch');
    const careerList = document.getElementById('careerList');
    const step3Next = document.getElementById('step3Next');
    const step3Prev = document.getElementById('step3Prev');

    // Step 4 Elements
    const charNameInput = document.getElementById('charName');
    const summaryContent = document.getElementById('summaryContent');
    const createCharBtn = document.getElementById('createCharBtn');
    const step4Prev = document.getElementById('step4Prev');

    // --- Navigation ---
    function goToStep(step) {
        state.step = step;
        steps.forEach((el, index) => {
            if (index + 1 === step) el.classList.add('active');
            else el.classList.remove('active');
        });

        dots.forEach((el, index) => {
            if (index + 1 === step) el.classList.add('active');
            else el.classList.remove('active');

            if (index + 1 < step) el.classList.add('completed');
            else el.classList.remove('completed');
        });

        if (step === 2) {
            selectedRaceDisplay.textContent = state.race;
            if (!state.stats) {
                renderStatsPlaceholder();
            }
        } else if (step === 3) {
            loadCareers();
        } else if (step === 4) {
            renderSummary();
        }
    }

    // --- Step 1: Race ---
    raceOptions.forEach(option => {
        option.addEventListener('click', () => {
            raceOptions.forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            state.race = option.dataset.race;
            step1Next.disabled = false;
        });
    });

    step1Next.addEventListener('click', () => goToStep(2));

    // --- Step 2: Stats ---
    step2Prev.addEventListener('click', () => goToStep(1));
    step2Next.addEventListener('click', () => goToStep(3));

    function rollD10() {
        return Math.floor(Math.random() * 10) + 1;
    }

    function renderStatsPlaceholder() {
        mainStatsContainer.innerHTML = '';
        const stats = ['WS', 'BS', 'S', 'T', 'Ag', 'Int', 'WP', 'Fel'];
        stats.forEach(stat => {
            mainStatsContainer.innerHTML += `
                <div class="stat-box">
                    <div class="stat-label">${stat}</div>
                    <div class="stat-value">-</div>
                </div>
            `;
        });
    }

    rollStatsBtn.addEventListener('click', () => {
        const base = RACES[state.race];
        state.stats = {
            ws: base.ws + rollD10() + rollD10(),
            bs: base.bs + rollD10() + rollD10(),
            s: base.s + rollD10() + rollD10(),
            t: base.t + rollD10() + rollD10(),
            ag: base.ag + rollD10() + rollD10(),
            int: base.int + rollD10() + rollD10(),
            wp: base.wp + rollD10() + rollD10(),
            fel: base.fel + rollD10() + rollD10()
        };

        // Wounds logic
        let wounds = 0;
        const wRoll = rollD10();
        if (state.race === 'Umano') wounds = wRoll <= 3 ? 10 : (wRoll <= 6 ? 11 : (wRoll <= 9 ? 12 : 13));
        if (state.race === 'Elfo') wounds = wRoll <= 3 ? 9 : (wRoll <= 6 ? 10 : (wRoll <= 9 ? 11 : 12));
        if (state.race === 'Nano') wounds = wRoll <= 3 ? 11 : (wRoll <= 6 ? 12 : (wRoll <= 9 ? 13 : 14));
        if (state.race === 'Mezzuomo') wounds = wRoll <= 3 ? 8 : (wRoll <= 6 ? 9 : (wRoll <= 9 ? 10 : 11));

        // Fate points
        const fateRoll = rollD10();
        let fate = 0;
        // Simplified Logic for Fate: 50/50 split for range, or exact range logic if available
        // Using range from book (approximate logic for simplicity or exact if possible)
        // Human: 1-4: 2, 5-7: 3, 8-10: 3 (wait, book says 1-4=2, 5-7=3, 8-10=3? No usually via table)
        // Let's use simple random from range for now
        const fateRange = base.fate;
        fate = Math.floor(Math.random() * (fateRange[1] - fateRange[0] + 1)) + fateRange[0];

        state.secondaryStats = {
            a: 1,
            w: wounds,
            sb: Math.floor(state.stats.s / 10),
            tb: Math.floor(state.stats.t / 10),
            m: base.m,
            mag: 0,
            ip: 0,
            fp: fate
        };

        renderStats();
        step2Next.disabled = false;
    });

    function renderStats() {
        mainStatsContainer.innerHTML = '';
        const labels = { ws: 'WS', bs: 'BS', s: 'S', t: 'T', ag: 'Ag', int: 'Int', wp: 'WP', fel: 'Fel' };
        for (const [key, value] of Object.entries(state.stats)) {
            mainStatsContainer.innerHTML += `
                <div class="stat-box">
                    <div class="stat-label">${labels[key]}</div>
                    <div class="stat-value">${value}</div>
                </div>
            `;
        }

        secondaryStatsContainer.innerHTML = '';
        const secLabels = { a: 'A', w: 'W', sb: 'SB', tb: 'TB', m: 'M', mag: 'Mag', ip: 'IP', fp: 'FP' };
        for (const [key, value] of Object.entries(state.secondaryStats)) {
            secondaryStatsContainer.innerHTML += `
                <div class="stat-box">
                    <div class="stat-label">${secLabels[key]}</div>
                    <div class="stat-value">${value}</div>
                </div>
            `;
        }
    }

    // --- Step 3: Career ---
    let allCareers = [];

    async function loadCareers() {
        if (allCareers.length > 0) return;

        try {
            const response = await fetch('/api/careers');
            const data = await response.json();
            if (data.success) {
                allCareers = data.careers;
                renderCareers(allCareers);
            }
        } catch (error) {
            console.error('Error loading careers:', error);
        }
    }

    function renderCareers(careers) {
        careerList.innerHTML = '';
        careers.forEach(career => {
            const el = document.createElement('div');
            el.className = 'option-card';
            if (state.career && state.career.id === career.id) el.classList.add('selected');
            el.innerHTML = `<h3>${career.name}</h3>`;
            el.addEventListener('click', () => selectCareer(career, el));
            careerList.appendChild(el);
        });
    }

    function selectCareer(career, el) {
        document.querySelectorAll('#careerList .option-card').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        state.career = career;
        step3Next.disabled = false;
    }

    careerSearch.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allCareers.filter(c => c.name.toLowerCase().includes(term));
        renderCareers(filtered);
    });

    step3Prev.addEventListener('click', () => goToStep(2));
    step3Next.addEventListener('click', () => goToStep(4));

    // --- Step 4: Summary ---
    step4Prev.addEventListener('click', () => goToStep(3));

    charNameInput.addEventListener('input', (e) => {
        state.name = e.target.value;
        createCharBtn.disabled = !state.name.trim();
    });

    function renderSummary() {
        summaryContent.innerHTML = `
            <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 4px;">
                <p><strong>Razza:</strong> ${state.race}</p>
                <p><strong>Carriera:</strong> ${state.career ? state.career.name : '-'}</p>
                <hr style="border-color: var(--border-color); margin: 10px 0;">
                <p><strong>Profilo Principale:</strong></p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    ${Object.entries(state.stats).map(([k, v]) => `<span>${k.toUpperCase()}: ${v}</span>`).join(' | ')}
                </div>
                <p><strong>Profilo Secondario:</strong></p>
                 <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    ${Object.entries(state.secondaryStats).map(([k, v]) => `<span>${k.toUpperCase()}: ${v}</span>`).join(' | ')}
                </div>
            </div>
        `;
    }

    createCharBtn.addEventListener('click', async () => {
        if (!state.name.trim()) return;

        const payload = {
            name: state.name,
            race: state.race,
            career_id: state.career.id,
            stats: state.stats,
            secondary_stats: state.secondaryStats
        };

        try {
            const response = await fetch('/api/create_character', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (result.success) {
                alert('Personaggio creato con successo!');
                window.location.href = '/'; // or redirect to char sheet
            } else {
                alert('Errore creazione personaggio: ' + result.error);
            }
        } catch (e) {
            console.error(e);
            alert('Errore di comunicazione con il server');
        }
    });

});
