import json
import os
import pandas as pd
import sqlite3
from flask import Flask, render_template, request, g

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
    conn.commit()
    conn.close()

# Create table on startup
create_table()

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



def load_shop_data():
    """Reads the shop data from the CSV file."""
    csv_path = os.path.join(os.path.dirname(__file__), 'negozio.csv')
    if not os.path.exists(csv_path):
        return []
    
    try:
        df = pd.read_csv(csv_path, encoding='utf-8')
        # Convert DataFrame to a list of dictionaries for easy iteration in Jinja2
        items = df.to_dict(orient='records')
        
        availability_percentages = {
            "Abbondante": "65%",
            "Diffusa": "55%",
            "Comune": "45%",
            "Media": "35%",
            "Scarsa": "25%",
            "Rara": "15%",
            "Raro": "15%", # Handle typo in CSV
            "Molto Rara": "5%"
        }
        
        for item in items:
            availability = item.get('Disponibilità', '').strip()
            item['Percentuale'] = availability_percentages.get(availability, '')
            
        return items
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return []

def load_shop_types():
    """Reads the shop types configuration."""
    json_path = os.path.join(os.path.dirname(__file__), 'shop_types.json')
    if not os.path.exists(json_path):
        return {}
    
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading JSON: {e}")
        return {}

@app.route('/')
def index():
    return render_template('index.html')

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
    
    if selected_type and selected_type in shop_types:
        allowed_categories = shop_types[selected_type]
        items = [item for item in items if item.get('Tipo') in allowed_categories]

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
        
    return render_template('shop.html', items=items, shop_types=shop_types.keys(), selected_type=selected_type, selected_city_size=selected_city_size, selected_quality=selected_quality)

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
    sql = '''INSERT INTO npcs (name, traits, ws, bs, s, t, ag, int, wp, fel, a, w, m, mag, ip, fp, armor_head, armor_arms, armor_body, armor_legs, description, special_rules, talents, skills, armor, weapons, equipment)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'''
    values = (
        data.get('name'), data.get('traits'),
        data.get('ws'), data.get('bs'), data.get('s'), data.get('t'), data.get('ag'), data.get('int'), data.get('wp'), data.get('fel'),
        data.get('a'), data.get('w'), data.get('m'), data.get('mag'), data.get('ip'), data.get('fp'),
        data.get('armor_head'), data.get('armor_arms'), data.get('armor_body'), data.get('armor_legs'),
        data.get('description'), data.get('special_rules'),
        data.get('talents'), data.get('skills'), data.get('armor'), data.get('weapons'), data.get('equipment')
    )
    cursor = db.execute(sql, values)
    db.commit()
    return {'success': True, 'id': cursor.lastrowid}

@app.route('/api/npcs/<int:id>', methods=['PUT'])
def update_npc(id):
    data = request.json
    db = get_db()
    sql = '''UPDATE npcs SET name=?, traits=?, ws=?, bs=?, s=?, t=?, ag=?, int=?, wp=?, fel=?, a=?, w=?, m=?, mag=?, ip=?, fp=?, armor_head=?, armor_arms=?, armor_body=?, armor_legs=?, description=?, special_rules=?, talents=?, skills=?, armor=?, weapons=?, equipment=?
             WHERE id=?'''
    values = (
        data.get('name'), data.get('traits'),
        data.get('ws'), data.get('bs'), data.get('s'), data.get('t'), data.get('ag'), data.get('int'), data.get('wp'), data.get('fel'),
        data.get('a'), data.get('w'), data.get('m'), data.get('mag'), data.get('ip'), data.get('fp'),
        data.get('armor_head'), data.get('armor_arms'), data.get('armor_body'), data.get('armor_legs'),
        data.get('description'), data.get('special_rules'),
        data.get('talents'), data.get('skills'), data.get('armor'), data.get('weapons'), data.get('equipment'),
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
             description, special_rules, talents, skills, armor, weapons, equipment) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'''
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
        data.get('armor'), data.get('weapons'), data.get('equipment')
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
             description=?, special_rules=?, talents=?, skills=?, armor=?, weapons=?, equipment=? WHERE id=?'''
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
        data.get('armor'), data.get('weapons'), data.get('equipment'), id
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
             a, w, m, armor_head, armor_arms, armor_body, armor_legs)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'''
    values = (
        data.get('name'), data.get('description'),
        data.get('ws'), data.get('bs'), data.get('s'), data.get('t'),
        data.get('ag'), data.get('int'), data.get('wp'), data.get('fel'),
        data.get('a'), data.get('w'), data.get('m'),
        data.get('armor_head'), data.get('armor_arms'),
        data.get('armor_body'), data.get('armor_legs')
    )
    cursor = db.execute(sql, values)
    db.commit()
    return {'success': True, 'id': cursor.lastrowid}

@app.route('/api/player_characters/<int:id>', methods=['PUT'])
def update_player_character(id):
    data = request.json
    db = get_db()
    sql = '''UPDATE player_characters SET name=?, description=?, ws=?, bs=?, s=?, t=?, ag=?, int=?, wp=?, fel=?,
             a=?, w=?, m=?, armor_head=?, armor_arms=?, armor_body=?, armor_legs=? WHERE id=?'''
    values = (
        data.get('name'), data.get('description'),
        data.get('ws'), data.get('bs'), data.get('s'), data.get('t'),
        data.get('ag'), data.get('int'), data.get('wp'), data.get('fel'),
        data.get('a'), data.get('w'), data.get('m'),
        data.get('armor_head'), data.get('armor_arms'),
        data.get('armor_body'), data.get('armor_legs'), id
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



if __name__ == '__main__':
    app.run(debug=True, port=5001)
