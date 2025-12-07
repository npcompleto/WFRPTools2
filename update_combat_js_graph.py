import re

file_path = r'c:\Users\avalo\Documents\Development\WFRPTools2\WFRPTools2\static\js\combat.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add renderCombatGraph function
graph_code = """
// --- Graph Visualization ---
let network = null;

function renderCombatGraph() {
    const container = document.getElementById('combatGraph');
    if (!container) return;

    // Prepare nodes
    const nodesArray = combatants.map(c => ({
        id: c.instanceId,
        label: c.name + '\\n(Iniz: ' + (c.initiative || 0) + ')',
        shape: 'box',
        color: {
            background: c.isPG ? '#007bff' : '#dc3545',
            border: '#ffffff',
            highlight: { background: c.isPG ? '#0056b3' : '#bd2130', border: '#ffffff' }
        },
        font: { color: '#ffffff' }
    }));
    
    const nodes = new vis.DataSet(nodesArray);

    // Prepare edges
    const edgesArray = [];
    combatants.forEach(c => {
        if (c.targetId) {
            edgesArray.push({
                from: c.instanceId,
                to: c.targetId,
                arrows: 'to',
                color: { color: '#ffd700', highlight: '#ffd700' },
                width: 2
            });
        }
    });
    
    const edges = new vis.DataSet(edgesArray);

    const data = { nodes, edges };
    const options = {
        physics: {
            enabled: true,
            stabilization: { iterations: 100 }
        },
        layout: {
            randomSeed: 2
        },
        interaction: {
            dragNodes: true,
            zoomView: true,
            dragView: true
        }
    };

    if (network) {
        network.setData(data);
    } else {
        network = new vis.Network(container, data, options);
    }
}
"""

# Append to end of file
content += graph_code

# 2. Call renderCombatGraph inside renderCombatants
# Find the end of renderCombatants
# It ends with `container.appendChild(card);\n    });\n}`
# We want to insert `renderCombatGraph();` before the last `}`

pattern = r'(container\.appendChild\(card\);\s*\}\);\s*)(\})'
match = re.search(pattern, content)

if match:
    # Insert before the closing brace
    content = content[:match.start(2)] + "    renderCombatGraph();\n" + content[match.start(2):]
    print("Added renderCombatGraph call.")
else:
    print("Could not find end of renderCombatants to insert call.")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
    print("File saved.")
