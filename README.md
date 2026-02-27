# ColorCraft Studio 🎨✏️
**Photo → Adult Coloring Book Page Converter**
*Runs entirely on Cloudflare's free tier*

---

## What It Does
Upload any photo and ColorCraft converts it to a clean, print-ready coloring book page using AI (Replicate). Supports **single image** and **batch** modes, multiple styles, and PNG + PDF output.

---

## Architecture (All Free Tier)

```
Browser
  │
  ├─── Cloudflare Pages ──────── Hosts the static frontend (index.html)
  │
  └─── Cloudflare Pages Functions (= Workers)
         │   POST /api/convert
         │
         ├─── Replicate API ─── AI image-to-line-art conversion
         │    (free tier: limited runs/month)
         │
         └─── Cloudflare R2 ─── Stores output files
              (free: 10GB/mo, no egress fees)
```

---

## Setup (15 minutes)

### 1. Prerequisites
```bash
node -v          # need Node 18+
npm i -g wrangler
wrangler login   # authenticate with your Cloudflare account
```

### 2. Clone & Install
```bash
git clone <your-repo>
cd coloring-book-app
# No npm install needed — this is a pure static + Workers project
```

### 3. Create R2 Bucket
```bash
npx wrangler r2 bucket create colorcraft-outputs
```

Then enable **Public Access** on the bucket:
- Cloudflare Dashboard → R2 → `colorcraft-outputs` → Settings → **Public Access → Enable**
- Copy the public URL (looks like `https://pub-abc123.r2.dev`)

### 4. Get a Free Replicate API Key
1. Go to [replicate.com](https://replicate.com) and sign up (free)
2. Go to Account Settings → API Tokens
3. Create a new token

> **Free tier note**: Replicate gives you some free credits. For heavier use, it's pay-per-second (~$0.0023/image). Very affordable.

### 5. Set Secrets
```bash
# Set your Replicate token (never commit this to git)
npx wrangler pages secret put REPLICATE_API_TOKEN
# Paste your token when prompted

# Set your R2 public URL
npx wrangler pages secret put PUBLIC_R2_URL
# Paste: https://pub-xxxxxxxx.r2.dev
```

### 6. Deploy
```bash
npx wrangler pages deploy public --project-name colorcraft-studio
```

That's it! Cloudflare will give you a URL like `https://colorcraft-studio.pages.dev`.

---

## Local Development
```bash
npx wrangler pages dev public --compatibility-date=2024-09-23
```
The app runs at `http://localhost:8788`.

For local dev, set env vars in a `.dev.vars` file (gitignored):
```
REPLICATE_API_TOKEN=r8_your_token_here
PUBLIC_R2_URL=https://pub-xxxxxxxx.r2.dev
```

---

## AI Model Details

The Worker uses **Stable Diffusion img2img** via Replicate to convert photos to line art. You can swap to a different model by changing the `version` in `functions/api/convert.js`.

**Recommended model upgrades** (better quality, slightly higher cost):
| Model | Notes |
|---|---|
| `stability-ai/sdxl` | Better quality, SDXL base |
| `black-forest-labs/flux-dev` | Best quality, slower |
| `jagilley/controlnet-scribble` | Purpose-built for line art |
| `fofr/line-art` | Dedicated coloring book model |

To change, update the `version` hash in the Worker and adjust the input fields accordingly.

---

## Styles

| Style | Description | Best For |
|---|---|---|
| **Clean Outlines** | Simple bold lines, no shading | All skill levels |
| **Detailed Line Art** | Lines + internal shading guides | Intermediate |
| **Bold & Simple** | Thick lines, large shapes | Beginners / kids |
| **Intricate Detail** | Fine patterns, zentangle-esque | Advanced colorists |

---

## Output Options

### PNG
Standard image output. Stored in R2 and served via the public URL.

### PDF (Print-Ready 8.5×11")
The frontend generates a print-ready PDF using the browser's built-in print API:
```javascript
// Client-side PDF generation (no server needed)
// The "Download PDF" button opens a print-optimized view
window.print();
```

For a server-side PDF with proper embedding, add `pdf-lib` as a Worker dependency:
```bash
npm init
npm install pdf-lib
```
Then in `wrangler.toml` add `node_compat = true` and use:
```javascript
import { PDFDocument } from 'pdf-lib';
const pdfDoc = await PDFDocument.create();
const page = pdfDoc.addPage([612, 792]); // 8.5 x 11 at 72dpi
const img = await pdfDoc.embedPng(pngBytes);
page.drawImage(img, { x: 36, y: 36, width: 540, height: 540 });
const pdfBytes = await pdfDoc.save();
```

---

## Adding a Coloring Page Border

The `addPageBorder` function in the Worker is a placeholder. To add a decorative border + title area to each page, use one of these approaches:

**Option A: Client-side Canvas** (easiest)
```javascript
// In the browser, draw the converted image onto a canvas with a border
const canvas = document.createElement('canvas');
canvas.width = 850; canvas.height = 1100; // 8.5x11 at 100dpi
const ctx = canvas.getContext('2d');
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, 850, 1100);
// Draw decorative border
ctx.strokeStyle = '#333';
ctx.lineWidth = 4;
ctx.strokeRect(20, 80, 810, 1000);
// Title area
ctx.font = '20px Georgia';
ctx.fillStyle = '#666';
ctx.fillText('My Coloring Book', 325, 55);
// Draw converted image centered
const img = new Image();
img.src = resultUrl;
img.onload = () => { ctx.drawImage(img, 55, 115, 740, 940); };
```

**Option B: Cloudflare Images Transform** (advanced)
Use Cloudflare Image Resizing to overlay an SVG border frame.

---

## Batch Mode Tips

- **Concurrency slider**: Set to 2–3 for free Replicate tier (avoids rate limits)
- **Queue limit**: No hard limit, but process in batches of 20–30 for best results
- **Combined PDF**: Enable "Combined PDF" to get all pages in one downloadable file

---

## Cloudflare Free Tier Limits

| Service | Free Limit | Typical Usage |
|---|---|---|
| Pages | Unlimited requests | Static hosting |
| Workers/Functions | 100,000 req/day | ~100k conversions/day |
| R2 Storage | 10 GB/month | ~5,000 images |
| R2 Class-A Ops | 1M/month | Uploads/writes |
| R2 Class-B Ops | 10M/month | Downloads/reads |

---

## File Structure
```
coloring-book-app/
├── public/
│   └── index.html          ← Full frontend (single file)
├── functions/
│   └── api/
│       └── convert.js      ← Cloudflare Pages Function (Worker)
├── wrangler.toml           ← Cloudflare configuration
└── README.md
```

---

## Troubleshooting

**"REPLICATE_API_TOKEN is not configured"**
→ Run: `npx wrangler pages secret put REPLICATE_API_TOKEN`

**"Could not fetch image from URL"**
→ Some sites block cross-origin requests. Download the image and upload it directly.

**Images take too long**
→ Reduce detail level slider or switch to a faster Replicate model.

**R2 URLs return 403**
→ Make sure Public Access is enabled on your R2 bucket in the Cloudflare dashboard.

**Local dev: R2 not working**
→ Local dev uses a simulated R2. Set `PUBLIC_R2_URL` in `.dev.vars` pointing to your real bucket.
