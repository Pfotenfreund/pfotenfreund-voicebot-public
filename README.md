# Pfotenfreund Voice‑Agent Orchestrator

Dieses Repository liefert eine minimale Node.js‑Lösung, um Outbound‑Calls mit OpenAI’s GPT‑Realtime‑API zu steuern.  Es dient als Schnittstelle zwischen deinem CRM/Formular (via Zapier) und dem Voice‑Agent.  

## Funktionen

* **Call starten:** Empfängt Leads via HTTP und löst den Outbound‑Call mit der verifizierten Rufnummer aus.
* **Webhook für Events:** Nimmt Status‑ und Tool‑Calls vom Voice‑Agent entgegen und leitet die Ergebnisse an Zapier weiter (z.\u202fB. zur Erstellung von Kontakten/Deals in HubSpot).
* **Konfigurierbar:** Alle API‑Keys, Rufnummern und URLs werden über Umgebungsvariablen gesteuert.  Die Prompt‑Definition liegt separat in einer Textdatei (`agent_prompt.txt`).

## Dateien

| Datei | Zweck |
|------|------|
| `index.js` | Express‑Server mit zwei Endpoints: `/call/start` zum Initiieren von Gesprächen und `/events` für eingehende Webhooks der GPT‑Realtime‑API. |
| `agent_prompt.txt` | Der vollständige Prompt für den Voice‑Agent auf Deutsch.  Passe Inhalt und Tonalität nach Bedarf an. |
| `schema.json` | JSON‑Schema der `finalize_outcome`‑Funktion, die strukturierte Ergebnisse des Agents definiert. |
| `.env.example` | Beispiel für die benötigten Umgebungsvariablen.  Kopiere diese Datei zu `.env` und fülle sie aus. |

## Vorbereitung

### 1. Abhängigkeiten installieren

```bash
npm install express axios
```

### 2. `.env` anlegen

Erstelle eine Datei `.env` (oder setze die Variablen in deiner Deployment‑Umgebung) basierend auf `.env.example`:

```env
REALTIME_API_KEY=sk-...            # OpenAI Realtime‑API‑Key
REALTIME_BASE=https://api.openai.com # Basis‑URL (ggf. anpassen)
CALLER_ID=+498912345678             # Deine verifizierte Rufnummer
WEBHOOK_BASE=https://yourdomain.com # Base‑URL des Orchestrators für eingehende Events
ZAPIER_CATCH_HOOK_URL=https://hooks.zapier.com/...   # Zapier‑Webhook für Ergebnisdaten
ZAPIER_STATUS_HOOK_URL=https://hooks.zapier.com/...  # Zapier‑Webhook für Status‑Events
PORT=3000                            # Port, auf dem der Server läuft
```

### 3. Prompt anpassen

Bearbeite die Datei `agent_prompt.txt` nach deinen Vorgaben.  Dieser Prompt wird beim Start des Calls an den GPT‑Realtime‑Agenten übergeben.

### 4. Server starten

```bash
node index.js
```

Der Server lauscht auf dem Port aus der `.env` (Standard: `3000`).  Es gibt zwei Endpoints:

* **`POST /call/start`** – erwartet ein JSON mit `lead`‑Objekt.  Initiert einen Anruf.
* **`POST /events`** – wird von der GPT‑Realtime‑API aufgerufen, um Status‑ und Tool‑Events zu übermitteln.  Bei `tool_call` mit dem Namen `finalize_outcome` wird der Inhalt an deinen Zapier‑Webhook weitergeleitet.

## Zapier‑Integration

1. **Zap 1: Lead → Anruf starten**
   * Trigger: Neues Formular/Lead.  
   * Action: Zapier Webhook (POST) an `https://<dein‑orchestrator>/call/start` mit dem `lead`‑Payload.
2. **Zap 2: Ergebnisdaten verarbeiten**
   * Trigger: Catch Hook (URL aus `ZAPIER_CATCH_HOOK_URL`).  
   * Actions: (a) HubSpot Contact/Deal erstellen/aktualisieren; (b) Follow‑Up Nachricht (WhatsApp/SMS/E‑Mail).  
3. **Zap 3: Status überwachen**
   * Trigger: Catch Hook (URL aus `ZAPIER_STATUS_HOOK_URL`).  
   * Actions: Slack/Teams Benachrichtigungen bei `failed`, `no_answer`, `busy` etc.

## Hinweis

Dieses Beispiel stellt nur eine Grundstruktur bereit.  Je nach Release der GPT‑Realtime‑API können sich die Endpoints und Payload‑Felder ändern.  Überprüfe stets die aktuelle Dokumentation und passe das Skript entsprechend an.
