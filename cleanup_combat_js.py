import re

file_path = r'c:\Users\avalo\Documents\Development\WFRPTools2\WFRPTools2\static\js\combat.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove duplicate function
# The block starts with "// --- Graph Visualization ---"
# We match until the end of the function.
pattern = r'// --- Graph Visualization ---[\s\S]*?function renderCombatGraph\(\) \{[\s\S]*?\}\s*'
matches = list(re.finditer(pattern, content))

if len(matches) > 1:
    # Remove the last one
    last_match = matches[-1]
    content = content[:last_match.start()] + content[last_match.end():]
    print("Removed duplicate renderCombatGraph.")
else:
    print(f"Found {len(matches)} occurrences of renderCombatGraph.")

# 2. Insert call in renderCombatants
# It ends with `container.appendChild(card);` followed by `});` and `}`.
end_pattern = r'(container\.appendChild\(card\);\s*\}\);)(\s*\})'

if 'renderCombatGraph();' not in content[:1200]: # Check if it's already there in the first part of file
    match = re.search(end_pattern, content)
    if match:
        content = content[:match.start(2)] + "\n    renderCombatGraph();" + content[match.start(2):]
        print("Inserted renderCombatGraph call.")
    else:
        print("Could not find insertion point for renderCombatGraph call.")
else:
    print("renderCombatGraph call already present.")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
    print("File saved.")
