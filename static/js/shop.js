// Currency Constants
    const CO_TO_SC = 20;
    const SC_TO_P = 12;
    const CO_TO_P = CO_TO_SC * SC_TO_P; // 240

    let carts = JSON.parse(localStorage.getItem('wfrp_carts')) || [{ id: 1, name: 'Carrello 1', items: [] }];
    let activeCartId = carts.length > 0 ? carts[0].id : null;

    // Ensure there's always at least one cart
    if (carts.length === 0) {
        carts.push({ id: Date.now(), name: 'Carrello 1', items: [] });
        activeCartId = carts[0].id;
    }

    // If activeCartId is invalid, reset to first
    if (!carts.find(c => c.id === activeCartId)) {
        activeCartId = carts[0].id;
    }

    function saveCarts() {
        localStorage.setItem('wfrp_carts', JSON.stringify(carts));
        renderCarts();
    }

    function createNewCart() {
        const id = Date.now();
        const num = carts.length + 1;
        carts.push({ id: id, name: `Carrello ${num}`, items: [] });
        activeCartId = id;
        saveCarts();
    }

    function clearCarts() {
        if (confirm('Sei sicuro di voler cancellare tutti i carrelli?')) {
            carts = [{ id: Date.now(), name: 'Carrello 1', items: [] }];
            activeCartId = carts[0].id;
            saveCarts();
        }
    }

    function setActiveCart(id) {
        activeCartId = id;
        renderCarts();
    }

    function renameCart(id) {
        const cart = carts.find(c => c.id === id);
        if (cart) {
            const newName = prompt("Inserisci il nuovo nome per il carrello:", cart.name);
            if (newName && newName.trim() !== "") {
                cart.name = newName.trim();
                saveCarts();
            }
        }
    }

    function exportCart(id) {
        const cart = carts.find(c => c.id === id);
        if (!cart) return;

        let content = "";
        cart.items.forEach(item => {
            // Default to 0 if encumbrance is missing (old items)
            const enc = item.encumbrance || "0";
            content += `${item.name}\t${item.quality || 'Comune'}\t${enc}\n`;
        });

        navigator.clipboard.writeText(content).then(() => {
            alert("Carrello copiato negli appunti!");
        }).catch(err => {
            console.error('Errore durante la copia: ', err);
            // Fallback for older browsers or non-secure contexts
            const textArea = document.createElement("textarea");
            textArea.value = content;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                alert("Carrello copiato negli appunti!");
            } catch (err) {
                alert("Impossibile copiare negli appunti.");
            }
            document.body.removeChild(textArea);
        });
    }

    function parseCost(costStr) {
        if (!costStr) return 0;
        costStr = String(costStr).trim();

        // Match number and unit
        const match = costStr.match(/([\d\.]+)\s*([a-zA-Z]+)/);
        if (!match) return 0;

        const val = parseFloat(match[1]);
        const unit = match[2].toLowerCase();

        if (unit === 'co') return val * CO_TO_P;
        if (unit === 's' || unit === 'sc') return val * SC_TO_P;
        if (unit === 'p') return val;

        return 0;
    }

    function formatCost(pennies) {
        pennies = Math.round(pennies);
        if (pennies === 0) return "0p";

        const co = Math.floor(pennies / CO_TO_P);
        let remainder = pennies % CO_TO_P;

        const sc = Math.floor(remainder / SC_TO_P);
        const p = remainder % SC_TO_P;

        let parts = [];
        if (co > 0) parts.push(`${co}CO`);
        if (sc > 0) parts.push(`${sc}sc`);
        if (p > 0) parts.push(`${p}p`);

        return parts.join(' ');
    }

    function addToCart(name, costStr, encumbrance) {
        if (!activeCartId) {
            alert("Crea un carrello prima!");
            return;
        }

        const cart = carts.find(c => c.id === activeCartId);
        const quality = document.getElementById('quality').value;

        if (cart) {
            cart.items.push({
                name: name,
                costStr: costStr,
                value: parseCost(costStr),
                quality: quality,
                encumbrance: encumbrance
            });
            saveCarts();
        }
    }

    function removeFromCart(cartId, itemIndex) {
        const cart = carts.find(c => c.id === cartId);
        if (cart) {
            cart.items.splice(itemIndex, 1);
            saveCarts();
        }
    }

    function renderCarts() {
        const container = document.getElementById('carts-container');
        container.innerHTML = '';

        carts.forEach(cart => {
            const isActive = cart.id === activeCartId;
            const total = cart.items.reduce((sum, item) => sum + item.value, 0);

            const cartDiv = document.createElement('div');
            cartDiv.className = `cart-card ${isActive ? 'active' : ''}`;
            cartDiv.onclick = (e) => {
                // Only set active if we didn't click a button
                if (e.target.tagName !== 'BUTTON' && !e.target.classList.contains('remove-btn')) {
                    setActiveCart(cart.id);
                }
            };

            let itemsHtml = cart.items.map((item, idx) => `
                <div class="cart-item">
                    <div class="cart-item-details">
                        <div>${item.name}</div>
                        <div class="cart-item-quality">${item.quality || 'Comune'}</div>
                    </div>
                    <div class="cart-item-price">
                        ${item.costStr}
                        <span class="remove-btn" onclick="removeFromCart(${cart.id}, ${idx})">×</span>
                    </div>
                </div>
            `).join('');

            if (cart.items.length === 0) {
                itemsHtml = '<div style="color: #888; font-style: italic; font-size: 0.8rem;">Vuoto</div>';
            }

            cartDiv.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                    <div style="font-weight:bold;">
                        ${cart.name}
                        ${isActive ? '<span style="color:#ffd700; margin-left:5px;">★</span>' : ''}
                    </div>
                    <div>
                        <button class="btn-small" onclick="renameCart(${cart.id})" title="Rinomina">✎</button>
                        <button class="btn-small" onclick="exportCart(${cart.id})" title="Copia negli appunti">📋</button>
                    </div>
                </div>
                <div class="cart-items">
                    ${itemsHtml}
                </div>
                <div class="cart-total">
                    Totale: ${formatCost(total)}
                </div>
            `;

            container.appendChild(cartDiv);
        });
    }

    // Initial render
    renderCarts();