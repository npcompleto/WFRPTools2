
import sqlite3
import os

DATABASE = 'wfrp.db'

def update_db_schema():
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    
    # Create POIs table
    c.execute('''
        CREATE TABLE IF NOT EXISTS pois (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            map_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            population TEXT,
            x REAL NOT NULL,
            y REAL NOT NULL,
            FOREIGN KEY (map_id) REFERENCES maps (id)
        )
    ''')
    
    conn.commit()
    conn.close()
    print("Database schema updated with POIs table.")

if __name__ == "__main__":
    update_db_schema()
