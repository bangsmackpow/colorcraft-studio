# ColorCraft Studio

Convert photos into printable coloring book pages. Upload a photo, choose a style, and get clean line-art ready to download as PNG or print as PDF — all processing happens in your browser. Your photos never leave your device.

AI coloring tips powered by Google Gemini are optional and configured through the built-in Settings tab. The app works fully without any API key.

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Docker / Portainer](#-docker--portainer)
- [Cloudflare Pages + Workers](#️-cloudflare-pages--workers)
- [Reverse Proxy Setup](#-reverse-proxy-setup)
- [Local Development](#-local-development)
- [Settings Tab](#-settings-tab)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Coloring Styles](#coloring-styles)
- [Print Sizes](#print-sizes)
- [Roadmap](#roadmap)

---

## Features

- **4 line-art styles** — Clean Outlines, Detailed Line Art, Bold & Simple, Intricate Detail
- **Adjustable line weight and detail level** — fine-tune per image with sliders
- **5 print sizes** — Full page (8.5×11"), half page landscape, half page portrait, quarter page, A4
- **Custom page title** — printed at the top of the coloring page border
- **Before/after comparison slider** — drag to compare original photo vs coloring page
- **Single and batch mode** — convert one image or a whole queue, each with its own style
- **PNG download + print to PDF** — directly from the browser
- **Settings tab** — configure Gemini AI, view live quota usage, override app name
- **AI coloring tips** — optional Gemini integration; configured per-user in the Settings tab with your own API key
- **Configurable app name** — rebrand via environment variable (server) or Settings tab (browser)
- **Privacy-first** — all image processing runs in your browser; photos never leave your device

---

## How It Works

1. **Upload a photo** — drag and drop or click to browse. JPG, PNG, WEBP up to 10 MB
2. **Choose a style and settings** — line weight, detail level, print size, optional border and title
3. **Browser pipeline runs locally** — grayscale → smart blur → posterize → Sobel edge detection → line cleanup. The coloring page is ready in seconds with no network call
4. **AI tips load in the background** — if you have a Gemini key configured in Settings, coloring suggestions appear after the page renders. The page is fully usable before tips arrive
5. **Download or print** — save as PNG or open the browser print dialog pre-formatted for your chosen paper size

---

## Architecture

ColorCraft Studio is a single-page app with a thin backend. Understanding the split helps when deploying or customizing.

### Image Processing — Browser Only

All coloring page generation happens in the browser via the Canvas API. The pipeline:

```
Photo (your device)
  ↓ Grayscale conversion
  ↓ Smart blur (edge-preserving — kills texture noise, preserves object boundaries)
  ↓ Posterize (collapses photo gradients into flat tonal bands)
  ↓ Light smoothing blur (cleans up quantization steps)
  ↓ Sobel edge detection (fires only at boundaries between tonal bands)
  ↓ Edge thinning (1-pixel-wide ridges)
  ↓ Edge dilation (solid, continuous lines)
  ↓ Composite onto page canvas at print resolution
  → Clean coloring page PNG
```

The server **never receives or processes your image pixels.** The only network calls are optional: AI tips sent to Gemini, and the initial `/api/convert` GET used to read server-configured variables like `APP_NAME`.

### Backend — Thin API Layer

The backend has one job: serve the frontend and optionally proxy Gemini for server-configured deployments. It does not perform image processing.

| File | Runtime | Role |
|---|---|---|
| `server/server.js` | Node / Express | Docker and local dev — serves static files, handles `POST /api/convert` for server-side Gemini key |
| `functions/api/convert.js` | Cloudflare Workers | Pages deployment — same API surface, Workers runtime |

### AI Tips — Two Paths

Gemini tips can be configured two ways depending on deployment:

| Path | When used | Key storage |
|---|---|---|
| **Browser-direct** | User enters key in Settings tab | Browser `localStorage` — never sent to your server |
| **Server-side** | `GEMINI_API_KEY` set as env var / secret | Server env — shared across all users of that deployment |

The browser-direct path takes priority if a key is saved in Settings. This means individual users can bring their own key regardless of how the server is configured.

---

## 🐳 Docker / Portainer

Recommended for self-hosters. The image builds automatically via GitHub Actions on every push to `main` and is published to the GitHub Container Registry.

### Quick start with Portainer

1. In Portainer, go to **Stacks → Add Stack**
2. Name it `colorcraft-studio`
3. Paste the following, substituting your GitHub username:

```yaml
version: "3.8"

services:
  colorcraft:
    image: ghcr.io/bangsmackpow/colorcraft-studio:latest
    container_name: colorcraft-studio
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - APP_NAME=ColorCraft Studio
      - GEMINI_API_KEY=your_key_here        # optional
      - GEMINI_MODEL=gemini-2.0-flash       # optional
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.5"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/convert"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

4. Click **Deploy the stack**
5. Open `http://your-server-ip:3000`

`GEMINI_API_KEY` is optional — get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Users can also enter their own key in the Settings tab without any server configuration.

---

### Updating to a new version

In Portainer: go to your stack → **Pull and redeploy**.

Or from the command line:

```bash
docker compose pull && docker compose up -d
```

---

### Build and run locally with Docker

```bash
git clone https://github.com/bangsmackpow/colorcraft-studio.git
cd colorcraft-studio

cp .env.example .env       # edit .env and fill in your values

docker compose up --build  # http://localhost:3000
```

Other useful commands:

```bash
docker compose up --build -d    # run in background
docker compose down             # stop
docker compose logs -f          # stream logs
docker compose pull             # pull latest image
```

---

## ☁️ Cloudflare Pages + Workers

Cloudflare Pages hosts the static frontend for free with global CDN distribution. The `/api/convert` endpoint runs as a Cloudflare Pages Function (Workers runtime) in the same deployment.

### Prerequisites

- A free [Cloudflare account](https://cloudflare.com)
- Node.js 18+
- Wrangler CLI: `npm install -g wrangler && wrangler login`

### Deploy — Option A: Cloudflare Git Integration (recommended)

Connect your GitHub repo directly to Cloudflare Pages. Every push to `main` triggers an automatic deploy in ~30 seconds — no manual commands needed.

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**
2. Authorize GitHub and select your repository
3. Configure the build:
   - **Build command:** *(leave empty — no build step)*
   - **Build output directory:** `public`
4. Click **Save and Deploy**

Your app will be live at `https://colorcraft-studio.pages.dev`.

---

### Deploy — Option B: GitHub Actions (auto-deploy on push)

The repo includes a workflow at `.github/workflows/cloudflare-deploy.yml` that deploys to Cloudflare Pages on every push to `main`. It also automatically sets `APP_VERSION` so the in-app version checker stays accurate.

**One-time setup — add two GitHub secrets:**

1. In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → **My Profile → API Tokens → Create Token** → use the *Edit Cloudflare Workers* template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → right sidebar on any Pages/Workers page |

2. First deploy (creates the Pages project):

```bash
wrangler pages project create colorcraft-studio
wrangler pages deploy public --project-name colorcraft-studio
```

After that, every `git push` to `main` deploys automatically.

---

### Manual deploy

```bash
git clone https://github.com/bangsmackpow/colorcraft-studio.git
cd colorcraft-studio

# First time only
wrangler pages project create colorcraft-studio

# Deploy manually
wrangler pages deploy public --project-name colorcraft-studio
```

Your app will be live at `https://colorcraft-studio.pages.dev`.

### Configure secrets

All secrets are optional. The app runs without them — users can configure Gemini themselves via the Settings tab.

```bash
# Shared Gemini key for all users (optional)
wrangler pages secret put GEMINI_API_KEY --project-name colorcraft-studio

# Gemini model override (optional, defaults to gemini-2.0-flash)
wrangler pages secret put GEMINI_MODEL --project-name colorcraft-studio

# App name shown in header and tab (optional)
wrangler pages secret put APP_NAME --project-name colorcraft-studio
```

Or set these in the Cloudflare dashboard under **Pages → your project → Settings → Environment variables**.

### Local development with Wrangler

```bash
cp .env.example .dev.vars
# Edit .dev.vars with your values

wrangler pages dev public --compatibility-date=2024-09-23
# http://localhost:8788
```

### Optional: Cloudflare R2 storage

R2 can store uploaded originals for future gallery/history features. Without it the app works fine.

```bash
wrangler r2 bucket create colorcraft-originals
wrangler pages secret put PUBLIC_R2_URL --project-name colorcraft-studio
```

Add to `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "colorcraft-originals"
```

---

## 🔀 Reverse Proxy Setup

The app is a standard HTTP server with no WebSocket connections — any reverse proxy works.

### Caddy

```caddyfile
colorcraft.yourdomain.com {
    reverse_proxy colorcraft-studio:3000
}
```

Use the container name as the upstream if Caddy shares a Docker network with the app. Use `localhost:3000` if Caddy runs on the host.

Path-based (subdirectory instead of subdomain):

```caddyfile
yourdomain.com {
    handle /colorcraft/* {
        uri strip_prefix /colorcraft
        reverse_proxy colorcraft-studio:3000
    }
}
```

### Traefik

Remove the `ports:` block from your compose file when using Traefik — it routes directly to the container.

```yaml
services:
  colorcraft:
    image: ghcr.io/bangsmackpow/colorcraft-studio:latest
    container_name: colorcraft-studio
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - APP_NAME=ColorCraft Studio
    networks:
      - traefik-public
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.colorcraft.rule=Host(`colorcraft.yourdomain.com`)"
      - "traefik.http.routers.colorcraft.entrypoints=websecure"
      - "traefik.http.routers.colorcraft.tls.certresolver=letsencrypt"
      - "traefik.http.services.colorcraft.loadbalancer.server.port=3000"

networks:
  traefik-public:
    external: true
```

Replace `traefik-public` with your Traefik network name and `letsencrypt` with your cert resolver name.

### Nginx Proxy Manager

1. **Proxy Hosts → Add Proxy Host**
2. **Details tab:**
   - Domain: `colorcraft.yourdomain.com`
   - Scheme: `http`
   - Forward hostname: `colorcraft-studio` (container name) or server's local IP
   - Forward port: `3000`
   - Enable Block Common Exploits
3. **SSL tab:** Request new certificate, enable Force SSL and HTTP/2
4. Save

> NPM and the ColorCraft container must share a Docker network to use the container name as the hostname. Otherwise use the server's local IP.

---

## 💻 Local Development

### Node.js / Express

```bash
git clone https://github.com/bangsmackpow/colorcraft-studio.git
cd colorcraft-studio

npm install

cp .env.example .env
# Edit .env — set APP_NAME, GEMINI_API_KEY if desired

npm start        # http://localhost:3000
npm run dev      # auto-restarts on file changes
```

### Wrangler (Cloudflare runtime)

```bash
cp .env.example .dev.vars

wrangler pages dev public --compatibility-date=2024-09-23
# http://localhost:8788
```

Use Wrangler when testing changes to `functions/api/convert.js`. Use `npm run dev` for everything else — it starts faster.

---

## ⚙ Settings Tab

The Settings tab (third tab in the navigation) lets each user configure AI and personalization without touching server config.

### Version Check

The Settings tab shows the running version of the app alongside the latest version available on GitHub. If they differ, an update notice appears with instructions.

The running version is read from `/api/convert` (set at build time from `package.json`). The latest version is fetched live from `raw.githubusercontent.com`. No login or token required — it's a public file read.

**To signal a new release:** bump the `version` field in `package.json` before pushing. The GitHub Actions workflow automatically propagates the new version to Cloudflare via `APP_VERSION`. Docker deployments read it directly from `package.json` at startup.

> **Note:** Update `GITHUB_RAW_PKG` in `index.html` with your actual GitHub username before deploying — otherwise the version check won't be able to reach your repo.

### Gemini AI Setup

1. Get a free API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Open **Settings → AI Enhancement**
3. Paste your key and click **Save Key**
4. Click **Test Connection** to verify — the app pings the Gemini API directly from your browser
5. Check **Enable AI coloring tips** to activate

Your key is stored in your browser's `localStorage`. It is never sent to the ColorCraft server — Gemini API calls go directly from your browser to Google's servers.

### Quota Display

The quota panel shows:

- Free tier limit (1,500 requests/day on `gemini-2.0-flash`)
- Requests used this session
- Approximate time until daily quota resets (midnight UTC)

Each image conversion uses 1 request when AI tips are enabled.

### App Name Override

Type a custom name and click **Apply** to rename the app in your browser. This overrides the server-configured name locally and persists across sessions. Click **Reset to Default** to revert.

---

## Environment Variables

All variables are optional. The app runs without any configuration.

| Variable | Default | Deployment | Description |
|---|---|---|---|
| `PORT` | `3000` | Docker / local | Port the Express server listens on |
| `APP_NAME` | `ColorCraft Studio` | Both | App name in header and browser tab |
| `APP_VERSION` | *(from package.json)* | Both | Running version reported by `/api/convert`. Set automatically by the GitHub Actions deploy workflow on Cloudflare. Read from `package.json` on Docker |
| `GEMINI_API_KEY` | *(empty)* | Both | Server-side Gemini key — shared across all users. Individual users can set their own key in the Settings tab instead |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Both | Gemini model for server-side requests |
| `BUCKET` | *(empty)* | Cloudflare only | R2 bucket binding name |
| `PUBLIC_R2_URL` | *(empty)* | Cloudflare only | Public URL of R2 bucket |

**Where to set them:**

| Deployment | How |
|---|---|
| Docker / Portainer | `environment:` block in compose file, or `.env` alongside `docker-compose.yml` |
| Cloudflare Pages | `wrangler pages secret put VARIABLE` or Cloudflare dashboard |
| Local Express | `.env` file (copy from `.env.example`) |
| Local Wrangler | `.dev.vars` file (copy from `.env.example`) |

### APP_NAME across deployments

| Deployment | How it's applied |
|---|---|
| Docker | Express reads env var, injects into HTML before serving |
| Cloudflare Pages | Worker reads secret, returns in API response, JS updates DOM on load |
| Settings tab | User override stored in `localStorage`, applied immediately |

Priority order: Settings tab override → server env var → default (`ColorCraft Studio`)

---

## Project Structure

```
colorcraft-studio/
├── public/
│   └── index.html              # Entire frontend — UI, image pipeline, all styles
│                               # Single file, shared between all deployments
├── server/
│   └── server.js               # Express server (Docker / local)
│                               # Serves public/, handles POST /api/convert
├── functions/
│   └── api/
│       └── convert.js          # Cloudflare Pages Function (Workers runtime)
│                               # Same API contract as server.js
├── .github/
│   └── workflows/
│       ├── docker-build.yml        # Builds + pushes to ghcr.io on push to main
│       └── cloudflare-deploy.yml   # Deploys to Cloudflare Pages + sets APP_VERSION
├── Dockerfile                  # Multi-stage Node 20 Alpine build, non-root user
├── docker-compose.yml          # Portainer / Compose stack
├── wrangler.toml               # Cloudflare Pages configuration
├── package.json                # express, multer
├── .env.example                # Documents all env vars, template for .env / .dev.vars
└── .gitignore
```

The frontend is a single self-contained HTML file. The two server files (`server.js` and `convert.js`) share the same API contract — both accept `POST /api/convert` with a multipart image upload and return JSON with optional `coloringTips` and `appName` fields. Image processing does not happen on the server in either case.

---

## Coloring Styles

| Style | Character | Best for |
|---|---|---|
| **Clean Outlines** | Bold, clear boundaries | Classic coloring book look, all ages |
| **Detailed Line Art** | Medium lines + internal structure | Shading guidance, intermediate colorists |
| **Bold & Simple** | Thick lines, large open areas | Young children, beginners, simple subjects |
| **Intricate Detail** | Fine lines, maximum edge density | Advanced colorists, complex subjects |

The **Line Weight** slider scales the stroke thickness within each style. The **Detail Level** slider controls how many tonal bands the posterizer uses — more bands means more internal lines within objects.

---

## Print Sizes

| Size | Dimensions | Notes |
|---|---|---|
| Full page | 8.5 × 11" | US Letter — one image per page |
| Half page landscape | 11 × 4.25" | Two per sheet, cut horizontally |
| Half page portrait | 5.5 × 8.5" | Two per sheet, cut vertically |
| Quarter page | 5.5 × 4.25" | Four per sheet |
| A4 | 210 × 297mm | International standard |

All sizes render at 150 DPI. Images are fitted and centered with white letterboxing — nothing is cropped.

---

## Roadmap

- [ ] User accounts and saved conversion history
- [ ] Free and paid tiers via Stripe
- [ ] Batch ZIP download
- [ ] Additional AI provider support (OpenAI, Stability AI lineart)
- [ ] Custom watermark option

---

## License

MIT
