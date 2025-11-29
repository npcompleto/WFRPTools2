"""
Script to update the 'note' field in the diary table from the CSV file.
This is needed because the initial migration didn't include the notes.
"""
import sqlite3
import pandas as pd
import base64
import os

DATABASE = 'wfrp.db'
CSV_PATH = 'diario.csv'

def update_diary_notes():
    """Updates the note field in the diary table from the CSV file."""
    
    if not os.path.exists(CSV_PATH):
        print(f"Error: {CSV_PATH} not found!")
        return
    
    if not os.path.exists(DATABASE):
        print(f"Error: {DATABASE} not found!")
        return
    
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    
    try:
        print("Reading CSV file...")
        df = pd.read_csv(CSV_PATH, encoding='utf-8')
        
        updated_count = 0
        skipped_count = 0
        
        for _, row in df.iterrows():
            date_iso = row['date_iso']
            
            # Skip if date_iso is empty
            if pd.isna(date_iso) or not date_iso:
                skipped_count += 1
                continue
            
            # Decode note from base64
            try:
                note_encoded = row['note']
                if pd.notna(note_encoded) and note_encoded:
                    note_decoded = base64.b64decode(note_encoded).decode('utf-8')
                else:
                    note_decoded = ''
            except Exception as e:
                print(f"Error decoding note for {date_iso}: {e}")
                note_decoded = ''
                skipped_count += 1
                continue
            
            # Update the database
            try:
                c.execute('''
                    UPDATE diary 
                    SET note = ?
                    WHERE date_iso = ?
                ''', (note_decoded, date_iso))
                
                if c.rowcount > 0:
                    updated_count += 1
                    print(f"Updated note for {date_iso}")
                else:
                    print(f"Warning: No entry found for {date_iso}")
                    skipped_count += 1
                    
            except Exception as e:
                print(f"Error updating {date_iso}: {e}")
                skipped_count += 1
        
        conn.commit()
        print(f"\n✓ Migration complete!")
        print(f"  - Updated: {updated_count} entries")
        print(f"  - Skipped: {skipped_count} entries")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    update_diary_notes()
