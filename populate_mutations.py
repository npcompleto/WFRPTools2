import sqlite3
import csv
import io

DATABASE = 'wfrp.db'

csv_data = """min_dice,max_dice,mutation,effect
0,3,Ali,La creatura guadagna il talento Volante e ha velocità di volo 6
4,5,Artigli,Talento armi naturali
6,7,Aspetto Bestiale,-2d10% alla Simpatia
8,10,Aspetto Emaciato,-1d10% alla Forza
11,13,Aspetto Orrendo,Spaventoso o Terrificante se è già Spaventoso
14,15,Becco,Attacco BF-1
16,18,Braccio a tentacolo,Bonus +10% alle prove relative alle prese
19,21,Ciclope,AB/2
22,24,Coda Irta d'aculei,Attacco BF Da stordimento
25,27,Coda Prensile,+1d10% agilità. Può afferrare con la coda
28,30,Coda,+1d10% agilità.
31,32,Colore Bizzarro,Estetico
33,36,Corna,"Attacco BF-1. Se preso 2 volte BF, se preso 3, BF + Da Impatto"
37,38,Corpulento,+1d10% alla Forza
39,40,Cresta,Estetico
41,43,Enormemente Grasso,-1d10% alla Forza. + 1 Fe
44,46,Gambe Animali,+1 Movimento
47,49,Gambe Corte,-1 Movimento
50,52,Mente Distorta,-2d10% Int
53,55,Nasuto,Abilità Seguire Tracce
56,58,Occhi da Rana,-1d10% Simpatia
59,61,Occhi su Antenne,+1d10 Iniziativa
62,64,Orecchie Grandi,Talento Udito Acuto
65,67,Pelle a Scaglie,Talento Scaglie (1 fino a 5)
68,70,Pelle Coriacea,+10% Resistenza
71,72,Pelle Metallica,2 PA su tutto il corpo
73,75,Pelliccia spessa,1 PA su tutto il corpo
76,78,Pelliccia,Estetico
79,81,Piaghe purulente,-2d10% alla Simpatia
82,83,Rigenerazione,Prova di Resistenza ogni round per guadagnare 1 Fe
84,85,Sete di sangue,Talento Frenesia
86,88,Tanfo vergognoso,-2d10% Simpatia. Se hai il naso -5% AC se entro 2 metri
89,91,Tenaglia,Armi naturali Precise
92,94,Tre occhi,+5% Percepire sulla vista
95,97,Ventose,+20% Arrampicarsi
98,99,Zanne,Attacco BF-2. Precisa
100,100,Progenie del Caos,-2d10% Intelligenza e Simpatia. Guadagna 1d10/2 nuove mutazioni per eccesso"""

def populate_mutations():
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    
    # Clear existing data to avoid duplicates if run multiple times
    try:
        c.execute("DELETE FROM chaos_mutations")
    except sqlite3.OperationalError:
        print("Table chaos_mutations might not exist yet. Running migration...")
        c.execute('''
            CREATE TABLE IF NOT EXISTS chaos_mutations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                min_dice INTEGER,
                max_dice INTEGER,
                mutation TEXT,
                effect TEXT
            )
        ''')
    
    reader = csv.DictReader(io.StringIO(csv_data))
    
    for row in reader:
        c.execute('''
            INSERT INTO chaos_mutations (min_dice, max_dice, mutation, effect)
            VALUES (?, ?, ?, ?)
        ''', (int(row['min_dice']), int(row['max_dice']), row['mutation'], row['effect']))
        
    conn.commit()
    conn.close()
    print("Chaos mutations populated successfully.")

if __name__ == '__main__':
    populate_mutations()
