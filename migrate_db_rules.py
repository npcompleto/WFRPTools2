import sqlite3

DATABASE = 'wfrp.db'

def migrate_db():
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    
    try:
        # Try to add the new column
        print("Adding column special_rules...")
        c.execute("ALTER TABLE npcs ADD COLUMN special_rules TEXT")
    except sqlite3.OperationalError as e:
        print(f"Error adding special_rules (maybe it exists?): {e}")

    try:
        # Try to drop the old column (requires SQLite >= 3.35.0)
        print("Dropping column chaos_mutations...")
        c.execute("ALTER TABLE npcs DROP COLUMN chaos_mutations")
    except sqlite3.OperationalError as e:
        print(f"Could not drop chaos_mutations (might not be supported or already gone): {e}")
        print("Ignoring drop column error, proceeding...")
            
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == '__main__':
    migrate_db()
