document.addEventListener('DOMContentLoaded', () => {
    // Inject Styles needed for the widget
    const style = document.createElement('style');
    style.innerHTML = `
        #dice-widget {
            position: fixed;
            bottom: 20px;
            right: 90px; /* Left of XP widget */
            z-index: 9999;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        #dice-widget-btn {
            background-color: #9b59b6; /* Amethyst */
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
        #dice-widget-btn:hover {
            transform: scale(1.1);
        }
        #dice-panel {
            display: none;
            background-color: #2c3e50; /* Dark background */
            color: #ecf0f1;
            border: 2px solid #9b59b6;
            border-radius: 10px;
            padding: 15px;
            width: 250px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            margin-bottom: 10px;
            position: absolute;
            bottom: 60px;
            right: 0; /* Aligned to right of the container div */
        }
        #dice-panel h3 { margin-top: 0; color: #9b59b6; font-size: 1.1em; border-bottom: 1px solid #555; padding-bottom: 5px; text-align: center; }
        
        .dice-controls {
            display: flex;
            justify-content: space-around;
            margin-bottom: 15px;
        }

        .dice-btn {
            background-color: #8e44ad;
            color: white;
            border: none;
            border-radius: 5px;
            padding: 10px 15px;
            cursor: pointer;
            font-weight: bold;
            transition: background-color 0.2s;
        }
        .dice-btn:hover {
            background-color: #a569bd;
        }

        #dice-result-area {
            text-align: center;
            background: #34495e;
            padding: 10px;
            border-radius: 5px;
            min-height: 50px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        
        .dice-value {
            font-size: 2em;
            font-weight: bold;
            color: #f1c40f;
        }
        .dice-label {
            font-size: 0.8em;
            color: #bdc3c7;
        }
    `;
    document.head.appendChild(style);

    // Create Widget DOM
    const widgetDiv = document.createElement('div');
    widgetDiv.id = 'dice-widget';
    widgetDiv.innerHTML = `
        <div id="dice-panel">
            <h3>Lancio Dadi</h3>
            
            <div class="dice-controls">
                <button class="dice-btn" id="roll-d100-btn">d100</button>
                <button class="dice-btn" id="roll-d10-btn">d10</button>
            </div>

            <div id="dice-result-area">
                <div class="dice-label">Clicca per tirare</div>
            </div>
        </div>
        <button id="dice-widget-btn" title="Lancio Dadi">🎲</button>
    `;
    document.body.appendChild(widgetDiv);

    // Logic
    const btn = document.getElementById('dice-widget-btn');
    const panel = document.getElementById('dice-panel');
    const rollD100Btn = document.getElementById('roll-d100-btn');
    const rollD10Btn = document.getElementById('roll-d10-btn');
    const resultArea = document.getElementById('dice-result-area');

    let isOpen = false;

    // Toggle Panel
    btn.onclick = () => {
        isOpen = !isOpen;
        panel.style.display = isOpen ? 'block' : 'none';
    };

    function showResult(value, type) {
        resultArea.innerHTML = `
            <div class="dice-label">Risultato (${type})</div>
            <div class="dice-value">${value}</div>
        `;
    }

    rollD100Btn.onclick = () => {
        const val = Math.floor(Math.random() * 100) + 1;
        showResult(val, 'd100');
    };

    rollD10Btn.onclick = () => {
        const val = Math.floor(Math.random() * 10) + 1;
        showResult(val, 'd10');
    };
});
