# Modifiche al Sistema di Combattimento - Sezione PG

## Riepilogo delle Modifiche

Ho aggiunto con successo una nuova sezione per i **Personaggi Giocanti (PG)** nel sistema di combattimento. A differenza dei PNG, i PG hanno campi semplificati come richiesto.

## Campi PG

I Personaggi Giocanti includono solo i seguenti campi:

### Informazioni Base
- **Nome** (obbligatorio)
- **Descrizione** (opzionale)

### Caratteristiche Principali
- **AC** (Abilità Combattimento)
- **AB** (Abilità Balistica)
- **F** (Forza)
- **R** (Resistenza)
- **Ag** (Agilità)
- **Int** (Intelligenza)
- **Vol** (Volontà)
- **Sim** (Simpatia)

### Caratteristiche Secondarie
- **A** (Attacchi)
- **Fe** (Ferite)
- **M** (Movimento)

### Punti Armatura
- **Testa**
- **Braccia**
- **Corpo**
- **Gambe**

## Modifiche ai File

### 1. combat.html
- ✅ Aggiunta sezione HTML per visualizzare i PG
- ✅ Aggiunto modal per creare/modificare PG
- ✅ Aggiunte funzioni JavaScript per gestire i PG:
  - `loadPlayerCharacters()` - Carica i PG dal database
  - `renderPlayerCharacters()` - Visualizza i PG nella pagina
  - `openPGModal()` / `closePGModal()` - Gestisce il modal
  - `editPG(id)` - Modifica un PG esistente
  - `savePG(event)` - Salva un PG (nuovo o modificato)
  - `deletePG(id)` - Elimina un PG
  - `addPGToCombat(pgId)` - Aggiunge un PG al combattimento attivo

### 2. app.py
- ✅ Aggiunta tabella `player_characters` nel database SQLite
- ✅ Aggiunti endpoint API:
  - `GET /api/player_characters` - Ottiene tutti i PG
  - `POST /api/player_characters` - Crea un nuovo PG
  - `PUT /api/player_characters/<id>` - Aggiorna un PG esistente
  - `DELETE /api/player_characters/<id>` - Elimina un PG

## Struttura della Pagina Combat

La pagina ora ha la seguente struttura:

1. **Combattenti Attivi** - PNG e PG attualmente in combattimento
2. **Personaggi Giocanti (PG)** - ⭐ NUOVA SEZIONE
3. **PNG Modificati** - PNG personalizzati basati su PNG base
4. **Libreria PNG** - Tutti i PNG disponibili (in formato tabella)

## Come Usare

1. **Riavvia l'applicazione Flask** per creare la nuova tabella nel database
2. Vai alla pagina **Combattimento**
3. Nella sezione "Personaggi Giocanti (PG)", clicca su **"+ Nuovo PG"**
4. Compila i campi richiesti (solo quelli essenziali)
5. Clicca **"Salva"**
6. Il PG apparirà nella lista con un bordo blu (per distinguerlo dai PNG)
7. Puoi:
   - **Modificare** il PG cliccando su "Modifica"
   - **Eliminare** il PG cliccando su "Elimina"
   - **Aggiungere al Combattimento** cliccando su "Aggiungi al Combattimento"

## Differenze tra PG e PNG

| Caratteristica | PNG | PG |
|----------------|-----|-----|
| Campi | Completi (tutti i campi WFRP) | Semplificati (solo essenziali) |
| Colore bordo card | Verde (modificati) / Grigio (base) | Blu |
| Talenti | Sì | No |
| Abilità | Sì | No |
| Equipaggiamento | Sì (dettagliato) | No |
| Armi | Sì | No |
| Regole Speciali | Sì | No |
| Mag, Fol, PF | Sì | No |

## Note Tecniche

- La tabella `player_characters` viene creata automaticamente all'avvio dell'app
- I PG vengono salvati nel database SQLite (`wfrp.db`)
- I PG possono essere aggiunti al combattimento come i PNG
- Quando un PG viene aggiunto al combattimento, viene calcolata l'iniziativa (Ag + d10)
- I PG nel combattimento sono contrassegnati con `isPG: true`

## Prossimi Passi (Opzionali)

Se desideri ulteriori funzionalità, potresti considerare:
- Aggiungere la possibilità di importare PG da file
- Aggiungere campi per tracciare esperienza e avanzamenti
- Aggiungere note di sessione per ogni PG
- Collegare i PG alle carriere
