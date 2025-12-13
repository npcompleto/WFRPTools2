import json
import os
import pandas as pd
import sqlite3
from flask import Flask, render_template, request, g, send_from_directory
from PIL import Image
import math
import shutil
import google.generativeai as genai

# Configure Gemini
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

app = Flask(__name__)
DATABASE = 'wfrp.db'

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = get_db()
        with app.open_resource('schema.sql', mode='r') as f:
            db.cursor().executescript(f.read())
        db.commit()

def create_table():
    """Creates the npcs table if it doesn't exist."""
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS npcs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            traits TEXT,
            ws INTEGER, bs INTEGER, s INTEGER, t INTEGER, ag INTEGER, int INTEGER, wp INTEGER, fel INTEGER,
            a INTEGER, w INTEGER, m INTEGER, mag INTEGER, ip INTEGER, fp INTEGER,
            armor_head INTEGER, armor_arms INTEGER, armor_body INTEGER, armor_legs INTEGER,
            description TEXT, special_rules TEXT,
            talents TEXT, skills TEXT, armor TEXT, weapons TEXT, equipment TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS chaos_mutations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            min_dice INTEGER,
            max_dice INTEGER,
            mutation TEXT,
            effect TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS skills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            characteristic TEXT,
            type TEXT,
            description TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS talents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS modified_npcs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            base_npc_id INTEGER,
            name TEXT NOT NULL,
            traits TEXT,
            ws INTEGER, bs INTEGER, s INTEGER, t INTEGER, ag INTEGER, int INTEGER, wp INTEGER, fel INTEGER,
            a INTEGER, w INTEGER, m INTEGER, mag INTEGER, ip INTEGER, fp INTEGER,
            armor_head INTEGER, armor_arms INTEGER, armor_body INTEGER, armor_legs INTEGER,
            description TEXT, special_rules TEXT,
            talents TEXT, skills TEXT, armor TEXT, weapons TEXT, equipment TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS careers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            ws INTEGER, bs INTEGER, s INTEGER, t INTEGER, ag INTEGER, int INTEGER, wp INTEGER, fel INTEGER,
            a INTEGER, w INTEGER, m INTEGER, mag INTEGER, ip INTEGER, fp INTEGER,
            skills TEXT,
            talents TEXT,
            trappings TEXT,
            career_exits TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS diary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_iso TEXT UNIQUE NOT NULL,
            year INTEGER,
            month_index INTEGER,
            month_name TEXT,
            day INTEGER,
            note TEXT,
            weather_json TEXT,
            updated_at TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS player_characters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            ws INTEGER, bs INTEGER, s INTEGER, t INTEGER, ag INTEGER, int INTEGER, wp INTEGER, fel INTEGER,
            a INTEGER, w INTEGER, m INTEGER,
            armor_head INTEGER, armor_arms INTEGER, armor_body INTEGER, armor_legs INTEGER
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inventario TEXT NOT NULL,
            descrizione TEXT,
            ingombro INTEGER,
            disponibilita TEXT,
            costo TEXT,
            tipo TEXT,
            shop_types TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS maps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            width INTEGER,
            height INTEGER,

            min_zoom INTEGER DEFAULT 0,
            pixels_per_inch INTEGER DEFAULT 96,
            center_poi_id INTEGER REFERENCES pois(id)
        )
    ''')
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
    c.execute('''
        CREATE TABLE IF NOT EXISTS segments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            map_id INTEGER NOT NULL,
            start_poi_id INTEGER,
            end_poi_id INTEGER,
            start_x REAL,
            start_y REAL,
            end_x REAL,
            end_y REAL,
            distance REAL,
            description TEXT,
            points TEXT,
            transport TEXT DEFAULT 'piedi',
            FOREIGN KEY (map_id) REFERENCES maps (id),
            FOREIGN KEY (start_poi_id) REFERENCES pois (id),
            FOREIGN KEY (end_poi_id) REFERENCES pois (id)
        )
    ''')
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
    c.execute('''
        CREATE TABLE IF NOT EXISTS saved_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            content TEXT NOT NULL,
            type TEXT DEFAULT 'Generico',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS xp_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reason TEXT NOT NULL,
            amount INTEGER NOT NULL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS xp_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pg_id INTEGER NOT NULL,
            amount INTEGER NOT NULL,
            reason TEXT NOT NULL,
            date_assigned TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pg_id) REFERENCES player_characters (id)
        )
    ''')
    
    
    # Force update of Catalog to user's new specification
    # We clear the table first to ensure it matches exactly the requested list
    c.execute('DELETE FROM xp_catalog')
    
    presets = [
        ("Combattimento Molto Facile", 5),
        ("Combattimento Facile", 10),
        ("Combattimento Abituale", 15),
        ("Combattimento Normale", 20),
        ("Combattimento Impegnativo", 30),
        ("Combattimento Difficile", 40),
        ("Combattimento Molto Difficile", 50),
        ("Bonus Leadership", 5),
        ("Bonus Riassunto", 5),
        ("Bonus Inventiva", 5),
        ("Bonus Memoria trama", 5),
        ("Bonus Interpretazione", 5),
        ("Bonus Risoluzione Problema", 5),
        ("Bonus Scoperta", 5),
        ("Bonus Indagine", 5),
        ("Bonus Furtività", 5),
        ("Sessione di gioco", 30),
        ("Obiettivo di trama raggiunto", 50),
        ("Obiettivo di trama secondario", 15),
        ("Obiettivo di trama accessorio", 5)
    ]
    c.executemany('INSERT INTO xp_catalog (reason, amount) VALUES (?, ?)', presets)
    
    # Migration for title column
    try:
        c.execute('SELECT title FROM saved_events LIMIT 1')
    except sqlite3.OperationalError:
        print("Migrating saved_events table: adding title column")
        c.execute('ALTER TABLE saved_events ADD COLUMN title TEXT')

    c.execute('''
        CREATE TABLE IF NOT EXISTS diary_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_iso TEXT NOT NULL,
            filename TEXT NOT NULL,
            caption TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Migration for image_filename column
    try:
        c.execute('SELECT image_filename FROM saved_events LIMIT 1')
    except sqlite3.OperationalError:
        print("Migrating saved_events table: adding image_filename column")
        c.execute('ALTER TABLE saved_events ADD COLUMN image_filename TEXT')

    conn.commit()
    conn.close()

# Create table on startup
create_table()

# Configure Upload Folder for Diary Photos
DIARY_UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads', 'diary_photos')
if not os.path.exists(DIARY_UPLOAD_FOLDER):
    os.makedirs(DIARY_UPLOAD_FOLDER)

# Configure Upload Folder for Events
EVENTS_UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads', 'events')
if not os.path.exists(EVENTS_UPLOAD_FOLDER):
    os.makedirs(EVENTS_UPLOAD_FOLDER)

# Configure Upload Folder for Badges
BADGES_UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads', 'badges')
if not os.path.exists(BADGES_UPLOAD_FOLDER):
    os.makedirs(BADGES_UPLOAD_FOLDER)

def migrate_tables_add_images():
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    
    tables = ['npcs', 'modified_npcs', 'player_characters']
    for table in tables:
        try:
            c.execute(f'SELECT image_filename FROM {table} LIMIT 1')
        except sqlite3.OperationalError:
            print(f"Migrating {table} table: adding image_filename column")
            c.execute(f'ALTER TABLE {table} ADD COLUMN image_filename TEXT')

    # Migration for size column
    tables_size = ['npcs', 'modified_npcs']
    for table in tables_size:
        try:
            c.execute(f'SELECT size FROM {table} LIMIT 1')
        except sqlite3.OperationalError:
            print(f"Migrating {table} table: adding size column")
            c.execute(f'ALTER TABLE {table} ADD COLUMN size TEXT DEFAULT "1x1"')
            
    # New table for Tactical Maps
    c.execute('''
        CREATE TABLE IF NOT EXISTS tactical_maps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            image_filename TEXT NOT NULL,
            rows INTEGER DEFAULT 10,
            cols INTEGER DEFAULT 10,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
            
    conn.commit()
    conn.close()

# Run migrations
migrate_tables_add_images()

# Configure Upload Folder for Tactical Maps
TACTICAL_MAPS_UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads', 'tactical_maps')
if not os.path.exists(TACTICAL_MAPS_UPLOAD_FOLDER):
    os.makedirs(TACTICAL_MAPS_UPLOAD_FOLDER)

from werkzeug.utils import secure_filename

@app.route('/api/events/upload_image', methods=['POST'])
def upload_event_image():
    if 'image' not in request.files:
        return {'success': False, 'error': 'No file part'}, 400
    
    file = request.files['image']
    if file.filename == '':
        return {'success': False, 'error': 'No selected file'}, 400
        
    if file:
        try:
            filename = secure_filename(f"event_{int(datetime.now().timestamp())}_{file.filename}")
            file.save(os.path.join(EVENTS_UPLOAD_FOLDER, filename))
            return {'success': True, 'filename': filename}
        except Exception as e:
            return {'success': False, 'error': str(e)}, 500

@app.route('/api/upload_badge', methods=['POST'])
def upload_badge():
    if 'image' not in request.files:
        return {'success': False, 'error': 'No file part'}, 400
    
    file = request.files['image']
    if file.filename == '':
        return {'success': False, 'error': 'No selected file'}, 400
        
    if file:
        try:
            filename = secure_filename(f"badge_{int(datetime.now().timestamp())}_{file.filename}")
            file.save(os.path.join(BADGES_UPLOAD_FOLDER, filename))
            return {'success': True, 'filename': filename}
        except Exception as e:
            return {'success': False, 'error': str(e)}, 500

@app.route('/api/diary/photos/<date_iso>')
def get_diary_photos(date_iso):
    db = get_db()
    cursor = db.execute('SELECT * FROM diary_photos WHERE date_iso = ? ORDER BY created_at DESC', (date_iso,))
    photos = [dict(row) for row in cursor.fetchall()]
    return {'success': True, 'photos': photos}

@app.route('/api/diary/upload_photo', methods=['POST'])
def upload_diary_photo():
    if 'photo' not in request.files:
        return {'success': False, 'error': 'No file part'}, 400
    
    file = request.files['photo']
    date_iso = request.form.get('date_iso')
    caption = request.form.get('caption', '')
    
    if file.filename == '':
        return {'success': False, 'error': 'No selected file'}, 400
        
    if file and date_iso:
        try:
            filename = secure_filename(f"{date_iso}_{int(datetime.now().timestamp())}_{file.filename}")
            file.save(os.path.join(DIARY_UPLOAD_FOLDER, filename))
            
            db = get_db()
            db.execute('INSERT INTO diary_photos (date_iso, filename, caption) VALUES (?, ?, ?)',
                       (date_iso, filename, caption))
            db.commit()
            
            return {'success': True}
        except Exception as e:
            print(f"Photo upload error: {e}")
            return {'success': False, 'error': str(e)}, 500
            
    return {'success': False, 'error': 'Missing data'}, 400

@app.route('/api/diary/delete_photo/<int:photo_id>', methods=['POST'])
def delete_diary_photo(photo_id):
    try:
        db = get_db()
        cursor = db.execute('SELECT filename FROM diary_photos WHERE id = ?', (photo_id,))
        row = cursor.fetchone()
        
        if row:
            filename = row['filename']
            file_path = os.path.join(DIARY_UPLOAD_FOLDER, filename)
            if os.path.exists(file_path):
                os.remove(file_path)
            
            db.execute('DELETE FROM diary_photos WHERE id = ?', (photo_id,))
            db.commit()
            return {'success': True}
        else:
            return {'success': False, 'error': 'Photo not found'}, 404
    except Exception as e:
        return {'success': False, 'error': str(e)}, 500

def migrate_diary_csv_to_db():
    """Migrates diary data from diario.csv to the diary table if the table is empty."""
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    
    # Check if diary table is empty
    c.execute('SELECT COUNT(*) FROM diary')
    count = c.fetchone()[0]
    
    if count > 0:
        print(f"Diary table already contains {count} entries. Skipping migration.")
        conn.close()
        return
    
    # Check if CSV exists
    csv_path = os.path.join(os.path.dirname(__file__), 'diario.csv')
    if not os.path.exists(csv_path):
        print("diario.csv not found. Skipping migration.")
        conn.close()
        return
    
    try:
        print("Starting diary migration from CSV to database...")
        df = pd.read_csv(csv_path, encoding='utf-8')
        migrated_count = 0
        
        for _, row in df.iterrows():
            try:
                # Decode note from base64
                note_decoded = base64.b64decode(row['note']).decode('utf-8') if pd.notna(row['note']) and row['note'] else ''
            except Exception as e:
                print(f"Error decoding note for {row['date_iso']}: {e}")
                note_decoded = ''
            
            # Prepare data
            date_iso = row['date_iso']
            year = int(row['year']) if pd.notna(row['year']) else None
            month_index = int(row['month_index']) if pd.notna(row['month_index']) else None
            month_name = row['month_name'] if pd.notna(row['month_name']) else ''
            day = int(row['day']) if pd.notna(row['day']) else None
            weather_json = row['weather_json'] if pd.notna(row['weather_json']) else '{}'
            updated_at = row['updated_at'] if pd.notna(row['updated_at']) else ''
            
            # Insert into database
            c.execute('''
                INSERT INTO diary (date_iso, year, month_index, month_name, day, note, weather_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (date_iso, year, month_index, month_name, day, note_decoded, weather_json, updated_at))
            migrated_count += 1
        
        conn.commit()
        print(f"Successfully migrated {migrated_count} diary entries from CSV to database.")
    except Exception as e:
        print(f"Error during diary migration: {e}")
        conn.rollback()
    finally:
        conn.close()

# Run migration on startup
migrate_diary_csv_to_db()

def migrate_inventory_csv_to_db():
    """Migrates inventory data from negozio.csv to the inventory table if the table is empty."""
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    
    # Check if inventory table is empty
    c.execute('SELECT COUNT(*) FROM inventory')
    count = c.fetchone()[0]
    
    if count > 0:
        print(f"Inventory table already contains {count} entries. Skipping migration.")
        conn.close()
        return
    
    # Check if CSV exists
    csv_path = os.path.join(os.path.dirname(__file__), 'negozio.csv')
    if not os.path.exists(csv_path):
        print("negozio.csv not found. Skipping migration.")
        conn.close()
        return
    
    try:
        print("Starting inventory migration from CSV to database...")
        df = pd.read_csv(csv_path, encoding='utf-8')
        migrated_count = 0
        
        for _, row in df.iterrows():
            # Prepare data
            inventario = row['Inventario'] if pd.notna(row['Inventario']) else ''
            descrizione = row['Descrizione'] if pd.notna(row['Descrizione']) else ''
            ingombro = int(row['Ingombro']) if pd.notna(row['Ingombro']) and str(row['Ingombro']).strip() else 0
            disponibilita = row['Disponibilità'] if pd.notna(row['Disponibilità']) else ''
            costo = row['Costo'] if pd.notna(row['Costo']) else ''
            tipo = row['Tipo'] if pd.notna(row['Tipo']) else ''
            
            # Insert into database
            c.execute('''
                INSERT INTO inventory (inventario, descrizione, ingombro, disponibilita, costo, tipo)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (inventario, descrizione, ingombro, disponibilita, costo, tipo))
            migrated_count += 1
        
        conn.commit()
        print(f"Successfully migrated {migrated_count} inventory items from CSV to database.")
    except Exception as e:
        print(f"Error during inventory migration: {e}")
        conn.rollback()
    finally:
        conn.close()

# Run inventory migration on startup
migrate_inventory_csv_to_db()



def load_shop_data():
    """Reads the shop data from the inventory database."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    try:
        c.execute('SELECT * FROM inventory')
        rows = c.fetchall()
        
        # Convert to list of dictionaries with proper field names
        items = []
        for row in rows:
            item = {
                'Inventario': row['inventario'],
                'Descrizione': row['descrizione'],
                'Ingombro': row['ingombro'],
                'Disponibilità': row['disponibilita'],
                'Costo': row['costo'],
                'Tipo': row['tipo'],
                'shop_types': row['shop_types']
            }
            items.append(item)
        
        availability_percentages = {
            "Abbondante": "65%",
            "Diffusa": "55%",
            "Comune": "45%",
            "Media": "35%",
            "Scarsa": "25%",
            "Rara": "15%",
            "Raro": "15%", # Handle typo
            "Molto Rara": "5%"
        }
        
        for item in items:
            availability = item.get('Disponibilità', '').strip() if item.get('Disponibilità') else ''
            item['Percentuale'] = availability_percentages.get(availability, '')
            
        return items
    except Exception as e:
        print(f"Error reading inventory from database: {e}")
        return []
    finally:
        conn.close()

def load_shop_types():
    """Reads the shop types from the inventory database."""
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    
    try:
        # Get all unique shop_types from inventory
        c.execute('SELECT DISTINCT shop_types FROM inventory WHERE shop_types IS NOT NULL AND shop_types != ""')
        rows = c.fetchall()
        
        # Collect all unique shop types
        shop_types_set = set()
        for row in rows:
            if row[0]:
                # Split by comma and trim whitespace
                types = [t.strip() for t in row[0].split(',') if t.strip()]
                shop_types_set.update(types)
        
        # Return as sorted list
        return sorted(list(shop_types_set))
    except Exception as e:
        print(f"Error reading shop types from database: {e}")
        return []
    finally:
        conn.close()

@app.route('/')
def index():
    db = get_db()
    
    # Init default values
    current_date_display = "Nessuna data registrata"
    weather_data = None
    note = "Nessuna nota per questa giornata."
    holidays = []
    
    # Get the latest diary entry
    cursor = db.execute('SELECT * FROM diary ORDER BY date_iso DESC LIMIT 1')
    last_entry = cursor.fetchone()
    
    if last_entry:
        date_iso = last_entry['date_iso']
        note = last_entry['note'] if last_entry['note'] else "Nessuna nota."
        if last_entry['weather_json']:
            try:
                weather_data = json.loads(last_entry['weather_json'])
            except:
                pass
        
        # Parse date for display and holidays
        try:
            parts = date_iso.split('-')
            year = parts[0]
            month_idx = int(parts[1])
            day = int(parts[2])
            
            cal_data = load_calendar_data()
            if cal_data and 'months' in cal_data:
                # Validate month index
                if 1 <= month_idx <= len(cal_data['months']):
                    month_data = cal_data['months'][month_idx-1]
                    month_name = month_data['name']
                    season = month_data.get('season', '')
                    current_date_display = f"{day} {month_name} {year} ({season})"
                
                # Check holidays (DD-MM)
                check_str = f"{day:02d}-{month_idx:02d}"
                if 'holidays' in cal_data:
                    for h in cal_data['holidays']:
                        if h['date'] == check_str:
                            holidays.append(h)
            else:
                 current_date_display = date_iso
        except Exception as e:
            print(f"Date parsing error: {e}")
            current_date_display = date_iso
            
    return render_template('index.html', date=current_date_display, weather=weather_data, note=note, holidays=holidays)

@app.route('/shop')
def shop():
    items = load_shop_data()
    shop_types = load_shop_types()
    
    selected_type = request.args.get('type')
    
    selected_city_size = request.args.get('city_size')
    if not selected_city_size:
        selected_city_size = '< 1000'
        
    selected_quality = request.args.get('quality')
    if not selected_quality:
        selected_quality = 'Comune'
    
    # Filter by shop type using shop_types field
    if selected_type:
        filtered_items = []
        for item in items:
            shop_types_str = item.get('shop_types', '')
            if shop_types_str:
                # Split by comma and check if selected_type is in the list
                item_shop_types = [t.strip() for t in shop_types_str.split(',') if t.strip()]
                if selected_type in item_shop_types:
                    filtered_items.append(item)
        items = filtered_items

    # Quality Modifiers
    if selected_quality:
        quality_modifiers = {
            "Regale": {"avail": -4, "cost_mult": 100, "enc_mult": 0.3},
            "Nobiliare": {"avail": -3, "cost_mult": 50, "enc_mult": 0.4},
            "Eccezionale": {"avail": -2, "cost_mult": 10, "enc_mult": 0.5},
            "Buona": {"avail": -1, "cost_mult": 3, "enc_mult": 0.9},
            "Comune": {"avail": 0, "cost_mult": 1, "enc_mult": 1.0},
            "Scadente": {"avail": 1, "cost_mult": 0.5, "enc_mult": 2.0}
        }
        
        mod = quality_modifiers.get(selected_quality)
        
        if mod:
            # Availability Order
            avail_order = ["Molto Rara", "Rara", "Scarsa", "Media", "Comune", "Diffusa", "Abbondante"]
            
            for item in items:
                # 1. Modify Availability
                current_avail = item.get('Disponibilità', '').strip()
                # Handle typo "Raro" -> "Rara"
                if current_avail == "Raro": current_avail = "Rara"
                
                if current_avail in avail_order:
                    idx = avail_order.index(current_avail)
                    new_idx = idx + mod['avail']
                    # Clamp
                    new_idx = max(0, min(len(avail_order) - 1, new_idx))
                    new_avail = avail_order[new_idx]
                    item['Disponibilità'] = new_avail
                    
                    # Update Percentage based on new availability
                    # We need to re-fetch the base percentage for the new availability
                    # Note: City size modifier will be applied later on this NEW percentage
                    base_pct_str = {
                        "Abbondante": "65%", "Diffusa": "55%", "Comune": "45%",
                        "Media": "35%", "Scarsa": "25%", "Rara": "15%", "Molto Rara": "5%"
                    }.get(new_avail, "0%")
                    item['Percentuale'] = base_pct_str

                # 2. Modify Cost
                cost_str = str(item.get('Costo', ''))
                import re
                match = re.match(r"(\d+(?:\.\d+)?)\s*([a-zA-Z]+)", cost_str)
                if match:
                    val = float(match.group(1))
                    unit = match.group(2)
                    new_val = val * mod['cost_mult']
                    # Format nicely (remove decimals if integer)
                    if new_val.is_integer():
                        item['Costo'] = f"{int(new_val)}{unit}"
                    else:
                        item['Costo'] = f"{new_val:.1f}{unit}"
                
                # 3. Modify Encumbrance
                enc_str = str(item.get('Ingombro', '0'))
                if enc_str.isdigit():
                    enc_val = int(enc_str)
                    new_enc = int(enc_val * mod['enc_mult'])
                    item['Ingombro'] = new_enc

    # Apply city size modifiers (Logic remains the same, but applies to potentially updated Percentuale)
    if selected_city_size:
        city_modifiers = {
            "< 100": -10,
            "< 1000": 0,
            "< 10000": 10,
            "> 10000": 20
        }
        modifier = city_modifiers.get(selected_city_size, 0)
        
        if modifier != 0:
            for item in items:
                pct_str = item.get('Percentuale', '').replace('%', '')
                if pct_str.isdigit():
                    new_pct = int(pct_str) + modifier
                    new_pct = max(0, min(100, new_pct))
                    item['Percentuale'] = f"{new_pct}%"
        
    return render_template('shop.html', items=items, shop_types=shop_types, selected_type=selected_type, selected_city_size=selected_city_size, selected_quality=selected_quality)

def load_calendar_data():
    """Reads the calendar configuration."""
    json_path = os.path.join(os.path.dirname(__file__), 'calendar.json')
    if not os.path.exists(json_path):
        return {}
    
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading Calendar JSON: {e}")
        return {}

import base64

def load_diary_data():
    """Reads the diary data from the database."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    try:
        c.execute('SELECT * FROM diary')
        rows = c.fetchall()
        
        # Create a dictionary keyed by date_iso for easy lookup
        diary_entries = {}
        for row in rows:
            weather_data = {}
            try:
                weather_raw = row['weather_json']
                if weather_raw:
                    weather_data = json.loads(weather_raw)
            except Exception as e:
                print(f"Error parsing weather JSON for {row['date_iso']}: {e}")
            
            diary_entries[row['date_iso']] = {
                'note': row['note'] or '',
                'weather': weather_data
            }
        return diary_entries
    except Exception as e:
        print(f"Error reading diary from database: {e}")
        return {}
    finally:
        conn.close()


from datetime import datetime
import random

def generate_random_weather(date_iso=None):
    """Generates random weather data for all 4 periods of the day, based on season."""
    periods = ['Mattino', 'Pomeriggio', 'Sera', 'Notte']
    weather_data = {}
    
    # Determine season from date
    season = 'Estivo'  # Default
    if date_iso:
        try:
            calendar_data = load_calendar_data()
            parts = date_iso.split('-')
            month_idx = int(parts[1])
            
            if 1 <= month_idx <= len(calendar_data.get('months', [])):
                season = calendar_data['months'][month_idx-1].get('season', 'Estivo')
        except:
            pass
    
    # Season-based weather parameters
    season_params = {
        'Invernale': {
            'temp_base': (-5, 8),      # Very cold
            'temp_variation': 5,
            'rain_prob': 0.4,          # 40% chance of rain
            'snow_prob': 0.5,          # 50% chance of snow if cold enough
            'snow_temp_threshold': 3,
            'cloudiness_bias': 70,     # More cloudy
        },
        'Primaverile': {
            'temp_base': (8, 18),      # Mild
            'temp_variation': 8,
            'rain_prob': 0.5,          # 50% chance of rain (rainy season)
            'snow_prob': 0.1,          # Rare snow
            'snow_temp_threshold': 2,
            'cloudiness_bias': 50,     # Variable
        },
        'Estivo': {
            'temp_base': (18, 32),     # Hot
            'temp_variation': 10,
            'rain_prob': 0.3,          # 30% chance of rain
            'snow_prob': 0.0,          # No snow
            'snow_temp_threshold': -10,
            'cloudiness_bias': 30,     # Less cloudy
        },
        'Autunnale': {
            'temp_base': (5, 15),      # Cool
            'temp_variation': 8,
            'rain_prob': 0.6,          # 60% chance of rain (rainy season)
            'snow_prob': 0.2,          # Some snow possible
            'snow_temp_threshold': 3,
            'cloudiness_bias': 60,     # More cloudy
        }
    }
    
    params = season_params.get(season, season_params['Estivo'])
    
    for period in periods:
        # Temperature range based on period and season
        temp_min, temp_max = params['temp_base']
        
        if period == 'Mattino':
            temp = round(random.uniform(temp_min, temp_min + params['temp_variation']), 1)
        elif period == 'Pomeriggio':
            temp = round(random.uniform(temp_max - params['temp_variation'], temp_max), 1)
        elif period == 'Sera':
            temp = round(random.uniform(temp_min + 2, temp_max - 2), 1)
        else:  # Notte
            temp = round(random.uniform(temp_min - 2, temp_min + params['temp_variation'] - 2), 1)
        
        # Wind speed (km/h) - more wind in autumn/winter
        if season in ['Autunnale', 'Invernale']:
            wind = round(random.uniform(5, 30), 1)
        else:
            wind = round(random.uniform(0, 20), 1)
        
        # Cloudiness percentage - biased by season
        cloudiness = min(100, max(0, int(random.gauss(params['cloudiness_bias'], 30))))
        
        # Rain probability and amount
        rain_chance = random.random()
        if rain_chance < (1 - params['rain_prob']):
            rain = 0.0
        else:
            rain = round(random.uniform(0.5, 20), 1)
        
        # Snow (based on season and temperature)
        snow = 0.0
        if temp < params['snow_temp_threshold'] and random.random() < params['snow_prob']:
            snow = round(random.uniform(0.5, 15), 1)
            rain = 0.0  # If it snows, no rain
        
        weather_data[period] = {
            'temperature_c': temp,
            'wind_kmh': wind,
            'cloudiness_pct': cloudiness,
            'rain_mm': rain,
            'snow_cm': snow
        }
    
    return weather_data

@app.route('/save_diary', methods=['POST'])
def save_diary():
    data = request.json
    date_iso = data.get('date')
    note_html = data.get('note')
    weather_json = data.get('weather')  # Get weather data from request
    
    if not date_iso:
        return {'success': False, 'error': 'No date provided'}, 400

    try:
        db = get_db()
        
        # Prepare weather JSON string
        weather_str = json.dumps(weather_json) if weather_json else '{}'
        
        # Check if entry exists
        cursor = db.execute('SELECT id, weather_json FROM diary WHERE date_iso = ?', (date_iso,))
        existing = cursor.fetchone()
        
        if existing:
            # Update existing entry
            # Only update weather if provided and not already set
            if weather_json and (not existing['weather_json'] or existing['weather_json'] == '{}'):
                db.execute('''
                    UPDATE diary 
                    SET note = ?, weather_json = ?, updated_at = ?
                    WHERE date_iso = ?
                ''', (note_html, weather_str, datetime.now().isoformat(), date_iso))
            else:
                db.execute('''
                    UPDATE diary 
                    SET note = ?, updated_at = ?
                    WHERE date_iso = ?
                ''', (note_html, datetime.now().isoformat(), date_iso))
        else:
            # Create new entry
            # Parse date to get components
            calendar_data = load_calendar_data()
            parts = date_iso.split('-')
            year = int(parts[0])
            month_idx = int(parts[1])
            day = int(parts[2])
            
            month_name = "Unknown"
            if 1 <= month_idx <= len(calendar_data.get('months', [])):
                month_name = calendar_data['months'][month_idx-1]['name']

            db.execute('''
                INSERT INTO diary (date_iso, year, month_index, month_name, day, note, weather_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (date_iso, year, month_idx, month_name, day, note_html, weather_str, datetime.now().isoformat()))
        
        db.commit()
        return {'success': True}
        
    except Exception as e:
        print(f"Error saving diary: {e}")
        return {'success': False, 'error': str(e)}, 500


@app.route('/generate_weather', methods=['GET'])
def generate_weather():
    """API endpoint to generate random weather data based on date/season."""
    date_iso = request.args.get('date')
    weather_data = generate_random_weather(date_iso)
    return {'success': True, 'weather': weather_data}

@app.route('/calendar')
def calendar():
    calendar_data = load_calendar_data()
    diary_data = load_diary_data()
    return render_template('calendar.html', calendar=calendar_data, diary=diary_data)

@app.route('/combat')
def combat():
    return render_template('combat.html')

@app.route('/api/npcs', methods=['GET'])
def get_npcs():
    db = get_db()
    cursor = db.execute('SELECT * FROM npcs')
    npcs = [dict(row) for row in cursor.fetchall()]
    return {'success': True, 'npcs': npcs}

@app.route('/api/npcs', methods=['POST'])
def add_npc():
    data = request.json
    db = get_db()
    sql = '''INSERT INTO npcs (name, traits, ws, bs, s, t, ag, int, wp, fel, a, w, m, mag, ip, fp, armor_head, armor_arms, armor_body, armor_legs, description, special_rules, talents, skills, armor, weapons, equipment, image_filename, size)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'''
    values = (
        data.get('name'), data.get('traits'),
        data.get('ws'), data.get('bs'), data.get('s'), data.get('t'), data.get('ag'), data.get('int'), data.get('wp'), data.get('fel'),
        data.get('a'), data.get('w'), data.get('m'), data.get('mag'), data.get('ip'), data.get('fp'),
        data.get('armor_head'), data.get('armor_arms'), data.get('armor_body'), data.get('armor_legs'),
        data.get('description'), data.get('special_rules'),
        data.get('talents'), data.get('skills'), data.get('armor'), data.get('weapons'), data.get('equipment'),
        data.get('image_filename'),
        data.get('size', '1x1')
    )
    cursor = db.execute(sql, values)
    db.commit()
    return {'success': True, 'id': cursor.lastrowid}

@app.route('/api/npcs/<int:id>', methods=['PUT'])
def update_npc(id):
    data = request.json
    db = get_db()
    sql = '''UPDATE npcs SET name=?, traits=?, ws=?, bs=?, s=?, t=?, ag=?, int=?, wp=?, fel=?, a=?, w=?, m=?, mag=?, ip=?, fp=?, armor_head=?, armor_arms=?, armor_body=?, armor_legs=?, description=?, special_rules=?, talents=?, skills=?, armor=?, weapons=?, equipment=?, image_filename=?, size=?
             WHERE id=?'''
    values = (
        data.get('name'), data.get('traits'),
        data.get('ws'), data.get('bs'), data.get('s'), data.get('t'), data.get('ag'), data.get('int'), data.get('wp'), data.get('fel'),
        data.get('a'), data.get('w'), data.get('m'), data.get('mag'), data.get('ip'), data.get('fp'),
        data.get('armor_head'), data.get('armor_arms'), data.get('armor_body'), data.get('armor_legs'),
        data.get('description'), data.get('special_rules'),
        data.get('talents'), data.get('skills'), data.get('armor'), data.get('weapons'), data.get('equipment'),
        data.get('image_filename'),
        data.get('size'),
        id
    )
    db.execute(sql, values)
    db.commit()
    return {'success': True}

@app.route('/api/npcs/<int:id>', methods=['DELETE'])
def delete_npc(id):
    db = get_db()
    db.execute('DELETE FROM npcs WHERE id = ?', (id,))
    db.commit()
    return {'success': True}

@app.route('/api/chaos_mutations', methods=['GET'])
def get_chaos_mutations():
    db = get_db()
    cursor = db.execute('SELECT * FROM chaos_mutations')
    mutations = [dict(row) for row in cursor.fetchall()]
    return {'success': True, 'mutations': mutations}

@app.route('/data')
def data_page():
    return render_template('data.html')

@app.route('/api/skills', methods=['GET'])
def get_skills():
    db = get_db()
    cursor = db.execute('SELECT * FROM skills')
    skills = [dict(row) for row in cursor.fetchall()]
    return {'success': True, 'skills': skills}

@app.route('/api/skills', methods=['POST'])
def add_skill():
    data = request.json
    db = get_db()
    sql = 'INSERT INTO skills (name, characteristic, type, description) VALUES (?, ?, ?, ?)'
    values = (data.get('name'), data.get('characteristic'), data.get('type'), data.get('description'))
    cursor = db.execute(sql, values)
    db.commit()
    return {'success': True, 'id': cursor.lastrowid}

@app.route('/api/skills/<int:id>', methods=['PUT'])
def update_skill(id):
    data = request.json
    db = get_db()
    sql = 'UPDATE skills SET name=?, characteristic=?, type=?, description=? WHERE id=?'
    values = (data.get('name'), data.get('characteristic'), data.get('type'), data.get('description'), id)
    db.execute(sql, values)
    db.commit()
    return {'success': True}

@app.route('/api/skills/<int:id>', methods=['DELETE'])
def delete_skill(id):
    db = get_db()
    db.execute('DELETE FROM skills WHERE id = ?', (id,))
    db.commit()
    return {'success': True}

@app.route('/api/chaos_mutations', methods=['POST'])
def add_chaos_mutation():
    data = request.json
    db = get_db()
    sql = 'INSERT INTO chaos_mutations (min_dice, max_dice, mutation, effect) VALUES (?, ?, ?, ?)'
    values = (data.get('min_dice'), data.get('max_dice'), data.get('mutation'), data.get('effect'))
    cursor = db.execute(sql, values)
    db.commit()
    return {'success': True, 'id': cursor.lastrowid}

@app.route('/api/chaos_mutations/<int:id>', methods=['PUT'])
def update_chaos_mutation(id):
    data = request.json
    db = get_db()
    sql = 'UPDATE chaos_mutations SET min_dice=?, max_dice=?, mutation=?, effect=? WHERE id=?'
    values = (data.get('min_dice'), data.get('max_dice'), data.get('mutation'), data.get('effect'), id)
    db.execute(sql, values)
    db.commit()
    return {'success': True}

@app.route('/api/chaos_mutations/<int:id>', methods=['DELETE'])
def delete_chaos_mutation(id):
    db = get_db()
    db.execute('DELETE FROM chaos_mutations WHERE id = ?', (id,))
    db.commit()
    return {'success': True}

# --- Map Management ---



@app.route('/api/maps/<int:id>', methods=['DELETE'])
def delete_map(id):
    try:
        db = get_db()
        db.execute('DELETE FROM maps WHERE id = ?', (id,))
        # Also delete POIs
        db.execute('DELETE FROM pois WHERE map_id = ?', (id,))
        db.commit()
        
        # Delete directory
        map_dir = os.path.join(app.root_path, 'static', 'maps', str(id))
        if os.path.exists(map_dir):
            shutil.rmtree(map_dir)
            
        return {'success': True}
    except Exception as e:
        print(f"Error deleting map: {e}")
        return {'success': False, 'error': str(e)}, 500

# --- POIs Management ---

@app.route('/api/maps/<int:map_id>/pois', methods=['GET'])
def get_map_pois(map_id):
    db = get_db()
    cursor = db.execute('SELECT * FROM pois WHERE map_id = ?', (map_id,))
    pois = [dict(row) for row in cursor.fetchall()]
    return {'success': True, 'pois': pois}

@app.route('/api/maps/<int:map_id>/pois', methods=['POST'])
def add_poi(map_id):
    data = request.json
    db = get_db()
    
    # Validation
    if not all(key in data for key in ['name', 'type', 'x', 'y']):
         return {'success': False, 'error': 'Missing required fields'}, 400
         
    sql = '''INSERT INTO pois (map_id, name, type, description, population, x, y)
             VALUES (?, ?, ?, ?, ?, ?, ?)'''
    values = (
        map_id,
        data.get('name'),
        data.get('type'),
        data.get('description', ''),
        data.get('population', ''),
        data.get('x'),
        data.get('y')
    )
    
    cursor = db.execute(sql, values)
    db.commit()
    return {'success': True, 'id': cursor.lastrowid}

@app.route('/api/pois/<int:id>', methods=['DELETE'])
def delete_poi(id):
    db = get_db()
    db.execute('DELETE FROM pois WHERE id = ?', (id,))
    db.commit()
    return {'success': True}

@app.route('/api/saved_events', methods=['GET'])
def get_saved_events():
    db = get_db()
    cursor = db.execute('SELECT * FROM saved_events ORDER BY created_at DESC')
    events = [dict(row) for row in cursor.fetchall()]
    return {'success': True, 'events': events}

@app.route('/api/saved_events', methods=['POST'])
def save_event():
    data = request.json
    db = get_db()
    db.execute('INSERT INTO saved_events (title, content, type, image_filename) VALUES (?, ?, ?, ?)', 
               (data.get('title', 'Evento'), data.get('content'), data.get('type'), data.get('image_filename')))
    db.commit()
    return {'success': True}

@app.route('/api/saved_events/<int:id>', methods=['PUT'])
def update_saved_event(id):
    data = request.json
    db = get_db()
    db.execute('UPDATE saved_events SET title = ?, content = ?, type = ?, image_filename = ? WHERE id = ?', 
               (data.get('title'), data.get('content'), data.get('type'), data.get('image_filename'), id))
    db.commit()
    return {'success': True}

@app.route('/api/saved_events/<int:id>', methods=['DELETE'])
def delete_saved_event(id):
    db = get_db()
    
    # Get filename to delete file
    cursor = db.execute('SELECT image_filename FROM saved_events WHERE id = ?', (id,))
    row = cursor.fetchone()
    if row and row['image_filename']:
        try:
            os.remove(os.path.join(EVENTS_UPLOAD_FOLDER, row['image_filename']))
        except Exception:
            pass # Ignore errors if file doesn't exist

    db.execute('DELETE FROM saved_events WHERE id = ?', (id,))
    db.commit()
    return {'success': True}

@app.route('/api/talents', methods=['GET'])
def get_talents():
    db = get_db()
    cursor = db.execute('SELECT * FROM talents ORDER BY name')
    talents = [dict(row) for row in cursor.fetchall()]
    return {'success': True, 'talents': talents}

@app.route('/api/talents', methods=['POST'])
def add_talent():
    data = request.json
    db = get_db()
    sql = 'INSERT INTO talents (name, description) VALUES (?, ?)'
    values = (data.get('name'), data.get('description'))
    cursor = db.execute(sql, values)
    db.commit()
    return {'success': True, 'id': cursor.lastrowid}

@app.route('/api/talents/<int:id>', methods=['PUT'])
def update_talent(id):
    data = request.json
    db = get_db()
    sql = 'UPDATE talents SET name=?, description=? WHERE id=?'
    values = (data.get('name'), data.get('description'), id)
    db.execute(sql, values)
    db.commit()
    return {'success': True}

@app.route('/api/talents/<int:id>', methods=['DELETE'])
def delete_talent(id):
    db = get_db()
    db.execute('DELETE FROM talents WHERE id = ?', (id,))
    db.commit()
    return {'success': True}

@app.route('/api/modified_npcs', methods=['GET'])
def get_modified_npcs():
    db = get_db()
    cursor = db.execute('SELECT * FROM modified_npcs')
    modified_npcs = [dict(row) for row in cursor.fetchall()]
    return {'success': True, 'modified_npcs': modified_npcs}

@app.route('/api/modified_npcs', methods=['POST'])
def add_modified_npc():
    data = request.json
    db = get_db()
    sql = '''INSERT INTO modified_npcs (base_npc_id, name, traits, ws, bs, s, t, ag, int, wp, fel, 
             a, w, m, mag, ip, fp, armor_head, armor_arms, armor_body, armor_legs, 
             description, special_rules, talents, skills, armor, weapons, equipment, image_filename, size) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'''
    values = (
        data.get('base_npc_id'), data.get('name'), data.get('traits'),
        data.get('ws'), data.get('bs'), data.get('s'), data.get('t'),
        data.get('ag'), data.get('int'), data.get('wp'), data.get('fel'),
        data.get('a'), data.get('w'), data.get('m'), data.get('mag'),
        data.get('ip'), data.get('fp'),
        data.get('armor_head'), data.get('armor_arms'),
        data.get('armor_body'), data.get('armor_legs'),
        data.get('description'), data.get('special_rules'),
        data.get('talents'), data.get('skills'),
        data.get('armor'), data.get('weapons'), data.get('equipment'),
        data.get('image_filename'),
        data.get('size', '1x1')
    )
    cursor = db.execute(sql, values)
    db.commit()
    return {'success': True, 'id': cursor.lastrowid}

@app.route('/api/modified_npcs/<int:id>', methods=['PUT'])
def update_modified_npc(id):
    data = request.json
    db = get_db()
    sql = '''UPDATE modified_npcs SET base_npc_id=?, name=?, traits=?, ws=?, bs=?, s=?, t=?, ag=?, int=?, wp=?, fel=?,
             a=?, w=?, m=?, mag=?, ip=?, fp=?, armor_head=?, armor_arms=?, armor_body=?, armor_legs=?,
             description=?, special_rules=?, talents=?, skills=?, armor=?, weapons=?, equipment=?, image_filename=?, size=? WHERE id=?'''
    values = (
        data.get('base_npc_id'), data.get('name'), data.get('traits'),
        data.get('ws'), data.get('bs'), data.get('s'), data.get('t'),
        data.get('ag'), data.get('int'), data.get('wp'), data.get('fel'),
        data.get('a'), data.get('w'), data.get('m'), data.get('mag'),
        data.get('ip'), data.get('fp'),
        data.get('armor_head'), data.get('armor_arms'),
        data.get('armor_body'), data.get('armor_legs'),
        data.get('description'), data.get('special_rules'),
        data.get('talents'), data.get('skills'),
        data.get('armor'), data.get('weapons'), data.get('equipment'), 
        data.get('image_filename'),
        data.get('size'),
        id
    )
    db.execute(sql, values)
    db.commit()
    return {'success': True}

@app.route('/api/modified_npcs/<int:id>', methods=['DELETE'])
def delete_modified_npc(id):
    db = get_db()
    db.execute('DELETE FROM modified_npcs WHERE id = ?', (id,))
    db.commit()
    return {'success': True}

# --- Careers API Endpoints ---

@app.route('/api/careers', methods=['GET'])
def get_careers():
    db = get_db()
    cursor = db.execute('SELECT * FROM careers')
    careers = [dict(row) for row in cursor.fetchall()]
    return {'success': True, 'careers': careers}

@app.route('/api/careers', methods=['POST'])
def add_career():
    data = request.json
    db = get_db()
    sql = '''INSERT INTO careers (name, description, ws, bs, s, t, ag, int, wp, fel,
             a, w, m, mag, ip, fp, skills, talents, trappings, career_exits)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'''
    values = (
        data.get('name'), data.get('description'),
        data.get('ws'), data.get('bs'), data.get('s'), data.get('t'),
        data.get('ag'), data.get('int'), data.get('wp'), data.get('fel'),
        data.get('a'), data.get('w'), data.get('m'), data.get('mag'),
        data.get('ip'), data.get('fp'),
        data.get('skills'), data.get('talents'),
        data.get('trappings'), data.get('career_exits')
    )
    cursor = db.execute(sql, values)
    db.commit()
    return {'success': True, 'id': cursor.lastrowid}

@app.route('/api/careers/<int:id>', methods=['PUT'])
def update_career(id):
    data = request.json
    db = get_db()
    sql = '''UPDATE careers SET name=?, description=?, ws=?, bs=?, s=?, t=?, ag=?, int=?, wp=?, fel=?,
             a=?, w=?, m=?, mag=?, ip=?, fp=?, skills=?, talents=?, trappings=?, career_exits=? WHERE id=?'''
    values = (
        data.get('name'), data.get('description'),
        data.get('ws'), data.get('bs'), data.get('s'), data.get('t'),
        data.get('ag'), data.get('int'), data.get('wp'), data.get('fel'),
        data.get('a'), data.get('w'), data.get('m'), data.get('mag'),
        data.get('ip'), data.get('fp'),
        data.get('skills'), data.get('talents'),
        data.get('trappings'), data.get('career_exits'), id
    )
    db.execute(sql, values)
    db.commit()
    return {'success': True}

@app.route('/api/careers/<int:id>', methods=['DELETE'])
def delete_career(id):
    db = get_db()
    db.execute('DELETE FROM careers WHERE id = ?', (id,))
    db.commit()
    return {'success': True}

# --- Player Characters API Endpoints ---

@app.route('/api/player_characters', methods=['GET'])
def get_player_characters():
    db = get_db()
    cursor = db.execute('SELECT * FROM player_characters')
    player_characters = [dict(row) for row in cursor.fetchall()]
    return {'success': True, 'player_characters': player_characters}

@app.route('/api/player_characters', methods=['POST'])
def add_player_character():
    data = request.json
    db = get_db()
    sql = '''INSERT INTO player_characters (name, description, ws, bs, s, t, ag, int, wp, fel,
             a, w, m, armor_head, armor_arms, armor_body, armor_legs, image_filename)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'''
    values = (
        data.get('name'), data.get('description'),
        data.get('ws'), data.get('bs'), data.get('s'), data.get('t'),
        data.get('ag'), data.get('int'), data.get('wp'), data.get('fel'),
        data.get('a'), data.get('w'), data.get('m'),
        data.get('armor_head'), data.get('armor_arms'),
        data.get('armor_body'), data.get('armor_legs'),
        data.get('image_filename')
    )
    cursor = db.execute(sql, values)
    db.commit()
    return {'success': True, 'id': cursor.lastrowid}

@app.route('/api/player_characters/<int:id>', methods=['PUT'])
def update_player_character(id):
    data = request.json
    db = get_db()
    sql = '''UPDATE player_characters SET name=?, description=?, ws=?, bs=?, s=?, t=?, ag=?, int=?, wp=?, fel=?,
             a=?, w=?, m=?, armor_head=?, armor_arms=?, armor_body=?, armor_legs=?, image_filename=? WHERE id=?'''
    values = (
        data.get('name'), data.get('description'),
        data.get('ws'), data.get('bs'), data.get('s'), data.get('t'),
        data.get('ag'), data.get('int'), data.get('wp'), data.get('fel'),
        data.get('a'), data.get('w'), data.get('m'),
        data.get('armor_head'), data.get('armor_arms'),
        data.get('armor_body'), data.get('armor_legs'),
        data.get('image_filename'),
        id
    )
    db.execute(sql, values)
    db.commit()
    return {'success': True}

@app.route('/api/player_characters/<int:id>', methods=['DELETE'])
def delete_player_character(id):
    db = get_db()
    db.execute('DELETE FROM player_characters WHERE id = ?', (id,))
    db.commit()
    return {'success': True}

@app.route('/api/maps', methods=['GET'])
def get_maps():
    db = get_db()
    cursor = db.execute('''
        SELECT m.*, p.name as center_poi_name, p.x as center_x, p.y as center_y 
        FROM maps m 
        LEFT JOIN pois p ON m.center_poi_id = p.id
    ''')
    items = [dict(row) for row in cursor.fetchall()]
    return {'success': True, 'maps': items}

@app.route('/api/maps', methods=['POST'])
def upload_map():
    name = request.form.get('name')
    file = request.files.get('image')
    
    if not name or not file:
        return {'success': False, 'error': 'Name and image are required'}, 400
        
    try:
        db = get_db()
        cursor = db.execute('INSERT INTO maps (name) VALUES (?)', (name,))
        map_id = cursor.lastrowid
        db.commit()
        
        # Process image
        width, height, max_zoom, ppi = process_map_image(file, map_id)
        
        # Update map details
        db.execute('UPDATE maps SET width=?, height=?, max_zoom=?, tile_format=?, min_zoom=0, pixels_per_inch=? WHERE id=?',
                   (width, height, max_zoom, 'jpg', ppi, map_id))
        db.commit()
        
        return {'success': True, 'id': map_id}
    except Exception as e:
        print(f"Error processing map: {e}")
        return {'success': False, 'error': str(e)}, 500

def process_map_image(file, map_id):
    """
    Processes the uploaded map image:
    1. Saves the original.
    2. Generates tiles for Leaflet (XYZ format).
    """
    map_dir = os.path.join(MAPS_FOLDER, str(map_id))
    if os.path.exists(map_dir):
        shutil.rmtree(map_dir)
    os.makedirs(map_dir)
    
    # Save original temporarily to process
    original_path = os.path.join(map_dir, 'original.img')
    file.save(original_path)
    
    # Disable decompression bomb check for large maps
    Image.MAX_IMAGE_PIXELS = None
    
    with Image.open(original_path) as img:
        width, height = img.size
        
        # Try to get DPI
        ppi = 96 # Default
        if 'dpi' in img.info:
            # DPI is usually a tuple (x, y)
            ppi = int(img.info['dpi'][0])
        
        # Calculate max zoom
        # Leaflet's CRS.Simple:
        # zoom 0: 1 tile (whole image fits in 256x256 approx)
        max_dim = max(width, height)
        max_zoom = math.ceil(math.log(max_dim / 256, 2))
        max_zoom = max(max_zoom, 0)
        
        tile_size = 256
        
        for z in range(max_zoom + 1):
            # Scale factor for this zoom level
            scale = pow(2, z - max_zoom) 
            
            level_width = int(width * scale)
            level_height = int(height * scale)
            
            if level_width <= 0 or level_height <= 0: continue
            
            img_level = img.resize((level_width, level_height), Image.Resampling.LANCZOS)
            
            cols = math.ceil(level_width / tile_size)
            rows = math.ceil(level_height / tile_size)
            
            z_dir = os.path.join(map_dir, str(z))
            if not os.path.exists(z_dir):
                os.makedirs(z_dir)
            
            for x in range(cols):
                for y in range(rows):
                    left = x * tile_size
                    upper = y * tile_size
                    right = min(left + tile_size, level_width)
                    lower = min(upper + tile_size, level_height)
                    
                    if right <= left or lower <= upper: continue
                    
                    tile = img_level.crop((left, upper, right, lower))
                    
                    tile_path = os.path.join(z_dir, f"{x}_{y}.jpg")
                    tile.save(tile_path, quality=85)
                    
        return width, height, max_zoom, ppi


# --- Map Center & POI Updates ---

@app.route('/api/maps/<int:map_id>/center', methods=['POST'])
def set_map_center(map_id):
    data = request.json
    poi_id = data.get('poi_id')
    db = get_db()
    db.execute('UPDATE maps SET center_poi_id = ? WHERE id = ?', (poi_id, map_id))
    db.commit()
    return {'success': True}

@app.route('/api/pois/<int:poi_id>', methods=['PUT'])
def update_poi(poi_id):
    data = request.json
    db = get_db()
    
    # Check if POI exists
    cursor = db.execute('SELECT id FROM pois WHERE id = ?', (poi_id,))
    if not cursor.fetchone():
        return {'success': False, 'error': 'POI not found'}, 404

    # Support updating position if provided
    updates = []
    values = []
    
    if 'name' in data:
        updates.append("name=?")
        values.append(data['name'])
    if 'type' in data:
        updates.append("type=?")
        values.append(data['type'])
    if 'population' in data:
        updates.append("population=?")
        values.append(data['population'])
    if 'description' in data:
        updates.append("description=?")
        values.append(data['description'])
    if 'x' in data:
        updates.append("x=?")
        values.append(data['x'])
    if 'y' in data:
        updates.append("y=?")
        values.append(data['y'])
        
    if not updates:
        return {'success': True} # Nothing to update
        
    values.append(poi_id)
    
    sql = f'''UPDATE pois SET {', '.join(updates)} WHERE id=?'''
    
    db.execute(sql, tuple(values))
    db.commit()
    return {'success': True}

# --- Segments Management ---

@app.route('/api/maps/<int:map_id>/segments', methods=['GET'])
def get_map_segments(map_id):
    db = get_db()
    cursor = db.execute('''
        SELECT s.*, 
               p1.name as start_poi_name, p1.type as start_poi_type,
               p2.name as end_poi_name, p2.type as end_poi_type
        FROM segments s
        LEFT JOIN pois p1 ON s.start_poi_id = p1.id
        LEFT JOIN pois p2 ON s.end_poi_id = p2.id
        WHERE s.map_id = ?
    ''', (map_id,))
    segments = [dict(row) for row in cursor.fetchall()]
    return {'success': True, 'segments': segments}

@app.route('/api/maps/<int:map_id>/segments', methods=['POST'])
def add_segment(map_id):
    data = request.json
    db = get_db()
    
    # We expect start_poi_id OR (start_x, start_y)
    # And end_poi_id OR (end_x, end_y)
    # And distance (optional)
    # And points (optional list of [lat, lng])
    
    points_json = None
    if 'points' in data:
        points_json = json.dumps(data['points'])
    
    sql = '''INSERT INTO segments (map_id, start_poi_id, end_poi_id, start_x, start_y, end_x, end_y, distance, description, points, transport)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'''
    
    values = (
        map_id,
        data.get('start_poi_id'),
        data.get('end_poi_id'),
        data.get('start_x'),
        data.get('start_y'),
        data.get('end_x'),
        data.get('end_y'),
        data.get('distance'),
        data.get('description', ''),
        points_json,
        data.get('transport', 'piedi')
    )
    
    cursor = db.execute(sql, values)
    db.commit()
    return {'success': True, 'id': cursor.lastrowid}

@app.route('/api/segments/<int:id>', methods=['PUT'])
def update_segment(id):
    data = request.json
    db = get_db()
    
    # We only allow updating transport, distance, and description for now as geometry edits are complex
    # unless we want to allow it. The user specifically asked for "modifica il mezzo", 
    # but likely wants to edit other simple fields triggers.
    
    sql = '''UPDATE segments SET transport=?, distance=?, description=? WHERE id=?'''
    values = (
        data.get('transport'),
        data.get('distance'),
        data.get('description'),
        id
    )
    
    db.execute(sql, values)
    db.commit()
    return {'success': True}

@app.route('/api/segments/<int:id>', methods=['DELETE'])
def delete_segment(id):
    db = get_db()
    db.execute('DELETE FROM segments WHERE id = ?', (id,))
    db.commit()
    return {'success': True}

@app.route('/api/generate_event', methods=['POST'])
def generate_event():
    if not GEMINI_API_KEY:
        return {'success': False, 'error': 'API Key non configurata (GEMINI_API_KEY)'}, 500
        
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            "Sei un Game Master per Warhammer Fantasy Roleplay. "
            "Genera un breve evento casuale di viaggio. "
            "L'evento può essere comico o tragico. "
            "Rispondi solo con la descrizione dell'evento."
            "Descrivi cosa vedono e anche i fatti dietro che deve sapere solo il GM."
            "Se ci sono personaggi, descrivili brevemente."
            "Se ci sono oggetti, descrivili brevemente."
            "Crea un prompt per una immagine che sia rappresentativa dell'evento."
        )
        return {'success': True, 'event': response.text}
    except Exception as e:
        print(f"Gemini Error: {e}")
        return {'success': False, 'error': str(e)}, 500

@app.route('/api/generate_night_event', methods=['POST'])
def generate_night_event():
    if not GEMINI_API_KEY:
        return {'success': False, 'error': 'API Key non configurata (GEMINI_API_KEY)'}, 500
        
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            "Sei un Game Master per Warhammer Fantasy Roleplay. "
            "Genera un breve evento casuale che accade durante la notte mentre i personaggi sono accampati. "
            "L'evento può essere inquietante, magico, di combattimento o banale ma interessante. "
            "Potrebbe riguardare sogni, rumori, visitatori o fenomeni atmosferici. "
            "Rispondi solo con la descrizione dell'evento. "
            "Descrivi cosa succede, eventuali tiri di dado richiesti e le conseguenze e anche i fatti dietro che deve sapere solo il GM."
            "Crea un prompt per una immagine che sia rappresentativa dell'evento."
        )
        return {'success': True, 'event': response.text}
    except Exception as e:
        print(f"Gemini Error: {e}")
        return {'success': False, 'error': str(e)}, 500





    return {'success': True}

# --- XP Widget APIs ---

@app.route('/api/xp/catalog', methods=['GET'])
def get_xp_catalog():
    db = get_db()
    cursor = db.execute('SELECT * FROM xp_catalog ORDER BY reason')
    return {'success': True, 'catalog': [dict(row) for row in cursor.fetchall()]}

@app.route('/api/public/pgs', methods=['GET'])
def get_public_pgs():
    # Get PG List with Total XP
    db = get_db()
    cursor = db.execute('''
        SELECT p.id, p.name, COALESCE(SUM(x.amount), 0) as total_xp
        FROM player_characters p
        LEFT JOIN xp_log x ON p.id = x.pg_id
        GROUP BY p.id, p.name
        ORDER BY p.name
    ''')
    return {'success': True, 'pgs': [dict(row) for row in cursor.fetchall()]}

@app.route('/api/xp/export/<int:pg_id>', methods=['GET'])
def get_xp_export(pg_id):
    db = get_db()
    # Get Total
    cursor = db.execute('SELECT COALESCE(SUM(amount), 0) as total FROM xp_log WHERE pg_id = ?', (pg_id,))
    total = cursor.fetchone()['total']
    
    # Get Log
    cursor = db.execute('''
        SELECT reason, amount, date_assigned 
        FROM xp_log 
        WHERE pg_id = ? 
        ORDER BY date_assigned DESC
    ''', (pg_id,))
    log = [dict(row) for row in cursor.fetchall()]
    
    return {'success': True, 'total': total, 'log': log}

@app.route('/api/xp/assign', methods=['POST'])
def assign_xp():
    data = request.json
    pg_ids = data.get('pg_ids', [])
    amount = data.get('amount')
    reason = data.get('reason')
    
    if not pg_ids or not amount or not reason:
        return {'success': False, 'error': 'Missing data'}, 400
        
    db = get_db()
    
    for pg_id in pg_ids:
        db.execute('INSERT INTO xp_log (pg_id, amount, reason) VALUES (?, ?, ?)',
                   (pg_id, amount, reason))
    
    db.commit()
    return {'success': True}

@app.route('/api/xp/reset', methods=['POST'])
def reset_xp():
    data = request.json
    pg_ids = data.get('pg_ids', [])
    
    if not pg_ids:
        return {'success': False, 'error': 'No PGs selected'}, 400
        
    db = get_db()
    # Delete logs for selected PGs
    # Using 'IN' clause safely with placeholders
    placeholders = ', '.join('?' for _ in pg_ids)
    db.execute(f'DELETE FROM xp_log WHERE pg_id IN ({placeholders})', pg_ids)
    db.commit()
    return {'success': True}

@app.route('/api/xp/session_stats', methods=['GET'])
def get_session_stats():
    db = get_db()
    # Assuming "Session" is "Today"
    cursor = db.execute('''
        SELECT SUM(amount) as total 
        FROM xp_log 
        WHERE date(date_assigned) = date('now')
    ''')
    row = cursor.fetchone()
    total = row['total'] if row and row['total'] else 0
    return {'success': True, 'total': total}


@app.route('/travel')
def travel():
    return render_template('travel.html')

# --- TACTICAL MAPS API ---

@app.route('/api/tactical_maps', methods=['GET'])
def get_tactical_maps():
    db = get_db()
    cursor = db.execute('SELECT * FROM tactical_maps ORDER BY created_at DESC')
    maps = [dict(row) for row in cursor.fetchall()]
    return {'success': True, 'maps': maps}

@app.route('/api/tactical_maps', methods=['POST'])
def save_tactical_map():
    if 'image' not in request.files:
         return {'success': False, 'error': 'No image file'}, 400
         
    file = request.files['image']
    title = request.form.get('title')
    rows = request.form.get('rows', 10)
    cols = request.form.get('cols', 10)
    
    if not title:
        return {'success': False, 'error': 'Title is required'}, 400

    if file.filename == '':
        return {'success': False, 'error': 'No selected file'}, 400

    try:
        filename = secure_filename(f"tactical_{int(datetime.now().timestamp())}_{file.filename}")
        file.save(os.path.join(TACTICAL_MAPS_UPLOAD_FOLDER, filename))
        
        db = get_db()
        cursor = db.execute(
            'INSERT INTO tactical_maps (title, image_filename, rows, cols) VALUES (?, ?, ?, ?)',
            (title, filename, rows, cols)
        )
        db.commit()
        
        return {'success': True, 'id': cursor.lastrowid, 'filename': filename}
    except Exception as e:
        return {'success': False, 'error': str(e)}, 500

@app.route('/api/tactical_maps/<int:id>', methods=['DELETE'])
def delete_tactical_map(id):
    db = get_db()
    
    # Optional: Delete file
    cursor = db.execute('SELECT image_filename FROM tactical_maps WHERE id = ?', (id,))
    row = cursor.fetchone()
    if row and row['image_filename']:
        file_path = os.path.join(TACTICAL_MAPS_UPLOAD_FOLDER, row['image_filename'])
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Error deleting file: {e}")

    db.execute('DELETE FROM tactical_maps WHERE id = ?', (id,))
    db.commit()
    return {'success': True}

if __name__ == '__main__':
    app.run(debug=True, port=5001)
