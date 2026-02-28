/**
 * ColorCraft Studio — Cloudflare Pages Function
 * POST /api/convert
 *
 * Gemini is OPTIONAL. The worker's only required job is to:
 *   1. Validate and echo the image back as a data URL (for canvas processing)
 *   2. Attempt Gemini tips if a key is present — but never block or fail on it
 *
 * The coloring page itself is rendered entirely client-side via Canvas.
 *
 * Environment variables:
 *   APP_NAME        — optional. Replaces "ColorCraft Studio" in the UI.
 *   GEMINI_API_KEY  — optional. If present, adds AI coloring tips.
 *   GEMINI_MODEL    — optional. Defaults to gemini-2.0-flash. Set this in
 *                     .dev.vars to use whatever model works on your account.
 *   BUCKET          — optional R2 bucket binding
 *   PUBLIC_R2_URL   — optional R2 public URL
 */

const TIPS_PROMPT = `You are a coloring book expert. Look at this image and provide 2-3 short, 
friendly, practical tips for someone about to color it as a coloring book page.
Focus on: color palette suggestions, which areas to color first, shading techniques, 
or any interesting features worth highlighting.
Keep it under 60 words total. Plain text only, no bullet points or markdown.`;

// ─── Pages Function exports ───────────────────────────────────────────────────
export async function onRequestPost(context) {
  const { request, env } = context;
  return corsResponse(await handleConvert(request, env));
}

export async function onRequestGet(context) {
  const { env } = context;
  return corsResponse(new Response(JSON.stringify({ status: 'ok', appName: env.APP_NAME || null }), {
    headers: { 'Content-Type': 'application/json' },
  }));
}

export async function onRequestOptions() {
  return corsResponse(new Response(null, { status: 204 }));
}

// ─── Main handler ─────────────────────────────────────────────────────────────
async function handleConvert(request, env) {
  try {
    const formData = await request.formData().catch(() => null);
    if (!formData) return jsonError('Invalid form data', 400);

    const imageFile = formData.get('image');
    if (!imageFile?.size) return jsonError('No image provided', 400);
    if (imageFile.size > 10 * 1024 * 1024) return jsonError('Image too large (max 10MB)', 400);

    const imageBytes    = await imageFile.arrayBuffer();
    const imageBase64   = arrayBufferToBase64(imageBytes);
    const imageMimeType = imageFile.type || 'image/jpeg';
    const imageDataUrl  = `data:${imageMimeType};base64,${imageBase64}`;

    // Store original in R2 if configured
    let originalUrl = imageDataUrl;
    if (env.BUCKET && env.PUBLIC_R2_URL) {
      try {
        const ext = imageMimeType.split('/')[1] || 'jpg';
        const key = `originals/${Date.now()}-${randomId()}.${ext}`;
        await env.BUCKET.put(key, imageBytes, { httpMetadata: { contentType: imageMimeType } });
        originalUrl = `${env.PUBLIC_R2_URL}/${key}`;
      } catch {
        // R2 failure is non-fatal — fall back to data URL
      }
    }

    // ─── Gemini tips — optional, non-blocking ────────────────────────────────
    // If no key, or if Gemini fails for any reason, we just skip tips entirely.
    // The coloring page renders fine without them.
    let coloringTips = null;

    if (env.GEMINI_API_KEY) {
      try {
        const model = env.GEMINI_MODEL || 'gemini-2.0-flash';
        const payload = {
          contents: [{
            parts: [
              { inline_data: { mime_type: imageMimeType, data: imageBase64 } },
              { text: TIPS_PROMPT },
            ],
          }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 150 },
        };

        // Use a short timeout — tips are bonus content, not worth waiting long for
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) coloringTips = text;
        }
      } catch {
        // Gemini failed (quota, timeout, wrong model, etc.) — silently skip tips
        coloringTips = null;
      }
    }

    return jsonResponse({
      success: true,
      imageDataUrl,
      originalUrl,
      coloringTips, // null if Gemini unavailable — frontend handles gracefully
      appName: env.APP_NAME || null,
    });

  } catch (err) {
    console.error('Convert error:', err);
    return jsonError(err.message || 'Internal server error', 500);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function randomId() { return Math.random().toString(36).slice(2, 10); }

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ success: false, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function corsResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(response.body, { status: response.status, headers });
}
