file_path = r'c:\Users\avalo\Documents\Development\WFRPTools2\WFRPTools2\static\js\combat.js'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# We want to keep lines up to 1877 (index 1876)
# Let's verify the content of line 1877 (index 1876)
# It should be "}"

if len(lines) > 1876:
    print(f"Line 1877 content: {lines[1876]}")
    if lines[1876].strip() == '}':
        new_lines = lines[:1877]
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print("File truncated successfully.")
    else:
        print("Line 1877 is not '}', aborting truncation to avoid data loss.")
        # Let's print surrounding lines to debug
        print(f"Lines 1875-1880: {lines[1874:1880]}")
else:
    print("File is shorter than expected.")
