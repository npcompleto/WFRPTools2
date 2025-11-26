import sqlite3

DATABASE = 'wfrp.db'

def migrate_db():
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    
    # Check if columns exist
    c.execute("PRAGMA table_info(npcs)")
    columns = [info[1] for info in c.fetchall()]
    
    new_columns = {
        'description': 'TEXT'
    }
    
    for col, dtype in new_columns.items():
        if col not in columns:
            print(f"Adding column {col}...")
            try:
                c.execute(f"ALTER TABLE npcs ADD COLUMN {col} {dtype}")
            except Exception as e:
                print(f"Error adding {col}: {e}")
        else:
            print(f"Column {col} already exists.")
            
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == '__main__':
    migrate_db()
