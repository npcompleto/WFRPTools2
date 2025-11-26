import sqlite3

DATABASE = 'wfrp.db'

def migrate_db():
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    
    print("Creating table chaos_mutations...")
    c.execute('''
        CREATE TABLE IF NOT EXISTS chaos_mutations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            min_dice INTEGER,
            max_dice INTEGER,
            mutation TEXT,
            effect TEXT
        )
    ''')
            
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == '__main__':
    migrate_db()
