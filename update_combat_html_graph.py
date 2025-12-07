import re

file_path = r'c:\Users\avalo\Documents\Development\WFRPTools2\WFRPTools2\templates\combat.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Insert Graph Container
# Find <div class="combat-grid"> and insert before it
graph_html = """
        <!-- Combat Graph Visualization -->
        <div id="combatGraph" class="combat-graph"></div>
"""

if '<div class="combat-grid">' in content:
    content = content.replace('<div class="combat-grid">', graph_html + '\n        <div class="combat-grid">')
    print("Graph container inserted.")
else:
    print("Error: combat-grid div not found.")

# 2. Move scripts to block scripts
# Remove existing script tag
script_tag = '<script src="{{ url_for(\'static\', filename=\'js/combat.js\') }}"></script>'
if script_tag in content:
    content = content.replace(script_tag, '')
    print("Old script tag removed.")
else:
    print("Warning: Old script tag not found exactly as expected.")

# Append block scripts at the end
scripts_block = """
{% block scripts %}
<script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
<script src="{{ url_for('static', filename='js/combat.js') }}"></script>
{% endblock %}
"""

content = content + scripts_block

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
    print("File saved.")
