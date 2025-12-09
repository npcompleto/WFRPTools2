
import sqlite3

DATABASE = 'wfrp.db'

def update_db_schema():
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    
    # Check if 'pixels_per_inch' column exists in 'maps' table
    try:
        c.execute('SELECT pixels_per_inch FROM maps LIMIT 1')
    except sqlite3.OperationalError:
        print("Adding 'pixels_per_inch' column to 'maps' table...")
        c.execute('ALTER TABLE maps ADD COLUMN pixels_per_inch INTEGER DEFAULT 96')
    
    conn.commit()
    conn.close()
    print("Database schema check complete.")

if __name__ == "__main__":
    update_db_schema()
