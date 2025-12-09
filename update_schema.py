
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

    try:
        c.execute('SELECT points FROM segments LIMIT 1')
    except sqlite3.OperationalError:
        print("Adding 'points' column to 'segments' table...")
        c.execute('ALTER TABLE segments ADD COLUMN points TEXT')

    try:
        c.execute('SELECT transport FROM segments LIMIT 1')
    except sqlite3.OperationalError:
        print("Adding 'transport' column to 'segments' table...")
        c.execute('ALTER TABLE segments ADD COLUMN transport TEXT DEFAULT "piedi"')

    try:
        c.execute('SELECT center_poi_id FROM maps LIMIT 1')
    except sqlite3.OperationalError:
        print("Adding 'center_poi_id' column to 'maps' table...")
        c.execute('ALTER TABLE maps ADD COLUMN center_poi_id INTEGER REFERENCES pois(id)')
    
    conn.commit()
    conn.close()
    print("Database schema check complete.")

if __name__ == "__main__":
    update_db_schema()
