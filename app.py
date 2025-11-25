import json
import os
import pandas as pd
from flask import Flask, render_template, request

app = Flask(__name__)

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
    """Reads the diary data from the CSV file."""
    csv_path = os.path.join(os.path.dirname(__file__), 'diario.csv')
    if not os.path.exists(csv_path):
        return {}
    
    try:
        df = pd.read_csv(csv_path, encoding='utf-8')
        # Create a dictionary keyed by date_iso for easy lookup
        diary_entries = {}
        for _, row in df.iterrows():
            try:
                note_decoded = base64.b64decode(row['note']).decode('utf-8')
            except:
                note_decoded = "Error decoding note"
            
            weather_data = {}
            try:
                weather_raw = row.get('weather_json', '{}')
                if pd.notna(weather_raw) and weather_raw:
                    weather_data = json.loads(weather_raw)
            except Exception as e:
                print(f"Error parsing weather JSON for {row['date_iso']}: {e}")

            diary_entries[row['date_iso']] = {
                'note': note_decoded,
                'weather': weather_data
            }
        return diary_entries
    except Exception as e:
        print(f"Error reading Diary CSV: {e}")
        return {}

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
        # Load existing data
        csv_path = os.path.join(os.path.dirname(__file__), 'diario.csv')
        if os.path.exists(csv_path):
            df = pd.read_csv(csv_path, encoding='utf-8')
        else:
            df = pd.DataFrame(columns=['date_iso', 'year', 'month_index', 'month_name', 'day', 'note', 'weather_json', 'updated_at'])

        # Encode note to base64
        note_b64 = base64.b64encode(note_html.encode('utf-8')).decode('utf-8')
        
        # Prepare weather JSON string
        weather_str = json.dumps(weather_json) if weather_json else '{}'
        
        # Check if entry exists
        if date_iso in df['date_iso'].values:
            # Update existing
            idx = df.index[df['date_iso'] == date_iso].tolist()[0]
            df.at[idx, 'note'] = note_b64
            df.at[idx, 'updated_at'] = datetime.now().isoformat()
            # Only update weather if provided and not already set
            if weather_json and (pd.isna(df.at[idx, 'weather_json']) or df.at[idx, 'weather_json'] == '{}'):
                df.at[idx, 'weather_json'] = weather_str
        else:
            # Create new entry
            # Parse date to get components
            # date_iso format is YYYY-MM-DD (Imperial)
            # We need to look up month name from calendar.json to be consistent, or just pass it from frontend
            # For simplicity, let's load calendar data to get month name
            calendar_data = load_calendar_data()
            parts = date_iso.split('-')
            year = int(parts[0])
            month_idx = int(parts[1])
            day = int(parts[2])
            
            month_name = "Unknown"
            if 1 <= month_idx <= len(calendar_data.get('months', [])):
                month_name = calendar_data['months'][month_idx-1]['name']

            new_row = {
                'date_iso': date_iso,
                'year': year,
                'month_index': month_idx,
                'month_name': month_name,
                'day': day,
                'note': note_b64,
                'weather_json': weather_str,
                'updated_at': datetime.now().isoformat()
            }
            df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)

        df.to_csv(csv_path, index=False, encoding='utf-8')
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

if __name__ == '__main__':
    app.run(debug=True, port=5001)
