'use strict';

/**
 * ColorCraft Studio — Express Server
 *
 * Drop-in replacement for the Cloudflare Pages Function.
 * Serves static files from /public and handles POST /api/convert.
 *
 * Environment variables (set in .env or docker-compose.yml):
 *   PORT            — defaults to 3000
 *   GEMINI_API_KEY  — optional. Enables AI coloring tips.
 *   GEMINI_MODEL    — optional. Defaults to gemini-2.0-flash.
 */

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const https    = require('https');

const app    = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const PORT         = process.env.PORT         || 3000;
const GEMINI_KEY   = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL  || 'gemini-2.0-flash';

const TIPS_PROMPT = `You are a coloring book expert. Look at this image and provide 2-3 short, \
friendly, practical tips for someone about to color it as a coloring book page. \
Focus on: color palette suggestions, which areas to color first, shading techniques, \
or any interesting features worth highlighting. \
Keep it under 60 words total. Plain text only, no bullet points or markdown.`;

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Static files with APP_NAME injection ─────────────────────────────────────
// Serve index.html with {{APP_NAME}} replaced so the header/title are configurable
// without touching the source file. All other static files served normally.
const fs = require('fs');

const APP_NAME = process.env.APP_NAME || 'ColorCraft Studio';
const indexPath = path.join(__dirname, '..', 'public', 'index.html');

app.get('/', (req, res) => {
  const html = fs.readFileSync(indexPath, 'utf8')
    .replaceAll('{{APP_NAME}}', APP_NAME);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/convert', (req, res) => {
  res.json({ status: 'ok', gemini: !!GEMINI_KEY, model: GEMINI_MODEL });
});

// ─── Main convert endpoint ────────────────────────────────────────────────────
app.post('/api/convert', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image provided' });
    }

    const imageBuffer   = req.file.buffer;
    const imageMimeType = req.file.mimetype || 'image/jpeg';
    const imageBase64   = imageBuffer.toString('base64');
    const imageDataUrl  = `data:${imageMimeType};base64,${imageBase64}`;

    // Gemini tips — optional, non-blocking
    let coloringTips = null;

    if (GEMINI_KEY) {
      try {
        const payload = JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: imageMimeType, data: imageBase64 } },
              { text: TIPS_PROMPT },
            ],
          }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 150 },
        });

        const text = await geminiRequest(payload);
        if (text) coloringTips = text;
      } catch (err) {
        // Gemini failed — silently skip, coloring page still works fine
        console.warn('Gemini tips skipped:', err.message);
      }
    }

    res.json({
      success: true,
      imageDataUrl,
      originalUrl: imageDataUrl,
      coloringTips,
    });

  } catch (err) {
    console.error('Convert error:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// ─── Gemini helper ────────────────────────────────────────────────────────────
function geminiRequest(payload) {
  return new Promise((resolve, reject) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    };

    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error('Gemini request timed out after 8s'));
    }, 8000);

    const req = https.request(url, options, (geminiRes) => {
      let body = '';
      geminiRes.on('data', chunk => body += chunk);
      geminiRes.on('end', () => {
        clearTimeout(timer);
        try {
          if (geminiRes.statusCode !== 200) {
            return reject(new Error(`Gemini HTTP ${geminiRes.statusCode}: ${body.slice(0, 200)}`));
          }
          const data = JSON.parse(body);
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
          resolve(text);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => { clearTimeout(timer); reject(e); });
    req.write(payload);
    req.end();
  });
}

// ─── Fallback: serve index.html for any unmatched route ──────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  ${APP_NAME.slice(0,36).padEnd(36)} ║
╠════════════════════════════════════════╣
║  http://localhost:${String(PORT).padEnd(21)}║
║  Gemini tips: ${GEMINI_KEY ? 'enabled ✓' : 'disabled (no key)'}${' '.repeat(GEMINI_KEY ? 15 : 8)}║
║  Model: ${GEMINI_MODEL.padEnd(31)}║
╚════════════════════════════════════════╝
  `);
});
