/*
 * Pfotenfreund Voice‑Agent Orchestrator
 *
 * Dieses Skript stellt zwei HTTP‑Endpunkte bereit:
 *  - POST /call/start  – Startet einen Outbound‑Call über die GPT‑Realtime‑API.
 *  - POST /events     – Empfängt Webhook‑Events (Status, Tool‑Calls) vom Agenten.
 *
 * Konfiguration über Umgebungsvariablen (.env). Das Prompt wird aus
 * agent_prompt.txt (oder einer Datei nach Wahl via AGENT_PROMPT_FILE) geladen.
 */

const fs = require('fs');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

// Lese das Prompt aus Datei. Fallback auf agent_prompt.txt im Arbeitsverzeichnis.
let agentPrompt;
try {
  const promptPath = process.env.AGENT_PROMPT_FILE || `${__dirname}/agent_prompt.txt`;
  agentPrompt = fs.readFileSync(promptPath, 'utf8');
} catch (err) {
  console.error('Fehler beim Laden des Prompts:', err.message);
  agentPrompt = '';
}

// Lade das Schema für den Tool‑Call finalize_outcome.
let finalizeSchema;
try {
  finalizeSchema = require('./schema.json');
} catch (err) {
  console.error('Fehler beim Laden des Schemas:', err.message);
  finalizeSchema = {};
}

const app = express();
app.use(express.json());

/**
 * Startet einen Outbound‑Call mit GPT‑Realtime.
 * Erwartet: { lead: { ... } }
 */
app.post('/call/start', async (req, res) => {
  const { lead } = req.body;
  if (!lead || !lead.phone) {
    return res.status(400).json({ ok: false, error: 'lead oder lead.phone fehlt' });
  }
  try {
    // Baue das Payload für die GPT‑Realtime‑API.
    const payload = {
      from: process.env.CALLER_ID,
      to: lead.phone,
      webhook_url: `${process.env.WEBHOOK_BASE}/events`,
      agent: {
        system_prompt: agentPrompt,
        knowledge: { products: ['Basis', 'Komfort', 'Premium'] },
        tools: [
          {
            name: 'finalize_outcome',
            schema: finalizeSchema
          }
        ]
      },
      context: {
        lead_id: lead.lead_id || null,
        lead
      }
    };

    // Sende POST an die GPT‑Realtime‑API. Endpoint kann je nach Release variieren.
    const apiBase = process.env.REALTIME_BASE || 'https://api.openai.com';
    const endpoint = `${apiBase}/v1/voice/streams/calls`;

    const response = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${process.env.REALTIME_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return res.json({ ok: true, session_id: response.data.session_id });
  } catch (err) {
    console.error('Fehler beim Starten des Calls:', err.response?.data || err.message);
    return res.status(500).json({ ok: false, error: 'call_start_failed' });
  }
});

/**
 * Empfängt Events von der GPT‑Realtime‑API.
 * Leitet relevante Daten an Zapier weiter.
 */
app.post('/events', async (req, res) => {
  const evt = req.body;
  try {
    if (evt.type === 'tool_call' && evt.name === 'finalize_outcome') {
      // Ergebnisdaten an Zapier weiterleiten
      await axios.post(process.env.ZAPIER_CATCH_HOOK_URL, evt.arguments);
    } else if (evt.type === 'completed' || evt.type === 'failed') {
      // Status an Zapier senden
      await axios.post(process.env.ZAPIER_STATUS_HOOK_URL, {
        lead_id: evt.context?.lead_id,
        status: evt.type,
        reason: evt.reason || null,
        duration_sec: evt.duration_sec || null
      });
    }
  } catch (err) {
    console.error('Fehler beim Senden an Zapier:', err.response?.data || err.message);
    // Wir schicken trotzdem 200 OK, damit die GPT‑API keine Wiederholungen auslöst.
  }
  return res.json({ ok: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Pfotenfreund Orchestrator lauscht auf Port ${port}`);
});
