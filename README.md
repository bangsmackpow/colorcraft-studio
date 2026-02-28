# ColorCraft Studio

Convert photos into printable coloring book pages. Upload a photo, choose a style, and get a clean line-art coloring page ready to download as PNG or print as PDF — entirely in your browser. No image is sent to a server for processing.

AI coloring tips powered by Google Gemini are optional. The app works fully offline without an API key.

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Docker / Portainer](#-docker--portainer)
- [Cloudflare Pages + Workers](#️-cloudflare-pages--workers)
- [Reverse Proxy Setup](#-reverse-proxy-setup)
- [Local Development](#-local-development)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)

---

## Features

- **4 line-art styles** — Clean Outlines, Detailed Line Art, Bold & Simple, Intricate Detail
- **Adjustable line weight and detail level** — fine-tune the output to your taste
- **5 print sizes** — Full page (8.5×11"), half page landscape, half page portrait, quarter page, A4
- **Custom page title** — set the title printed at the top of the coloring page
- **Before/after comparison slider** — see the original photo and coloring page side by side
- **Single and batch mode** — convert one image or a whole queue at once, each with its own style
- **PNG download + print to PDF** — straight from the browser, no server round trip
- **AI coloring tips** — optional Gemini integration adds coloring suggestions after each conversion
- **Configurable app name** — rebrand the header and browser tab via environment variable, no code changes needed
- **Privacy-friendly** — edge detection runs entirely in the browser via Canvas API; your photos never leave your device for the conversion step

---

## How It Works

1. **Upload a photo** — drag and drop or click to browse. JPG, PNG, WEBP up to 10 MB
2. **Choose a style and settings** — pick line weight, detail level, print size, and whether to add a decorative border with a custom title
3. **Canvas edge detection runs locally** — the Sobel edge detection algorithm extracts outlines directly in your browser. The coloring page appears in seconds
4. **AI tips load in the background** — if a Gemini API key is configured, coloring suggestions appear after the page is already rendered. The page is usable immediately without waiting
5. **Download or print** — save as PNG or open the browser print dialog pre-formatted for your chosen paper size

---

## 🐳 Docker / Portainer

This is the recommended path for self-hosters. The image is built automatically via GitHub Actions and published to the GitHub Container Registry on every push to `main`.

### Quick start with Portainer

1. In Portainer, go to **Stacks → Add Stack**
2. Name it `colorcraft-studio`
3. Paste the following into the compose editor, filling in your values:

```yaml
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
      - GEMINI_API_KEY=your_key_here
      - GEMINI_MODEL=gemini-2.0-flash
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

> **GEMINI_API_KEY** is optional. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Without it the app works fine — you just won't get AI coloring tips.

---

### Updating to a new version

When a new version is published, pull the latest image and redeploy in Portainer:

1. Go to your stack in Portainer
2. Click **Pull and redeploy**

Or from the command line on your server:

```bash
docker compose pull && docker compose up -d
```

---

### Build and run locally with Docker

```bash
git clone https://github.com/bangsmackpow/colorcraft-studio.git
cd colorcraft-studio

# Copy the example env file and fill in your values
cp .env.example .env

# Build and start
docker compose up --build
```

The app will be available at `http://localhost:3000`.

Other useful commands:

```bash
docker compose up --build -d    # run in background
docker compose down             # stop and remove containers
docker compose logs -f          # stream live logs
docker compose pull             # pull the latest image without rebuilding
```

---

## ☁️ Cloudflare Pages + Workers

Cloudflare Pages hosts the static frontend for free with global CDN distribution. The API endpoint (`/api/convert`) runs as a Cloudflare Pages Function (Workers runtime) in the same deployment. R2 can optionally be used to store uploaded originals.

### Prerequisites

- A free [Cloudflare account](https://cloudflare.com)
- [Node.js 18+](https://nodejs.org)
- Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

---

### Deploy to Cloudflare Pages

```bash
# Clone the repo
git clone https://github.com/bangsmackpow/colorcraft-studio.git
cd colorcraft-studio

# Create the Pages project (first time only)
wrangler pages project create colorcraft-studio

# Deploy
wrangler pages deploy public --project-name colorcraft-studio
```

Your app will be live at `https://colorcraft-studio.pages.dev`.

To redeploy after any code change:

```bash
wrangler pages deploy public --project-name colorcraft-studio
```

---

### Configure secrets on Cloudflare

Secrets are set separately from the deploy command. None are required — the app works without them.

```bash
# Optional — enables AI coloring tips
wrangler pages secret put GEMINI_API_KEY --project-name colorcraft-studio

# Optional — change which Gemini model is used
wrangler pages secret put GEMINI_MODEL --project-name colorcraft-studio

# Optional — rename the app in the header and browser tab
wrangler pages secret put APP_NAME --project-name colorcraft-studio
```

You can also set these in the Cloudflare dashboard under **Pages → your project → Settings → Environment variables**.

---

### Optional: Cloudflare R2 storage

R2 lets the worker store uploaded originals in object storage. Without it, the app still works — images are returned as data URLs and processed entirely in the browser. R2 is only useful if you plan to add a gallery or history feature later.

**Create a bucket:**

```bash
wrangler r2 bucket create colorcraft-originals
```

**Add the binding to `wrangler.toml`:**

```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "colorcraft-originals"
```

**Add the public URL secret:**

```bash
wrangler pages secret put PUBLIC_R2_URL --project-name colorcraft-studio
# Enter: https://pub-xxxxxxxxxxxxxxxx.r2.dev
```

---

### Local development with Wrangler

To test the Cloudflare Pages Function locally (instead of the Express server):

```bash
# Create your local secrets file
cp .env.example .dev.vars
# Edit .dev.vars and add GEMINI_API_KEY etc.

wrangler pages dev public --compatibility-date=2024-09-23
```

The app will be available at `http://localhost:8788`.

---

### How APP_NAME works across deployments

The app name shown in the header and browser tab is configurable without touching any code.

| Deployment | How to set it | How it's applied |
|---|---|---|
| **Docker** | `APP_NAME=My Studio` in `.env` or compose | Server injects it into the HTML before sending |
| **Cloudflare Pages** | `APP_NAME` secret via Wrangler or dashboard | API returns it on page load; JS updates the DOM |
| **Local dev (Express)** | `APP_NAME=My Studio` in `.env` | Same as Docker |
| **Local dev (Wrangler)** | `APP_NAME=My Studio` in `.dev.vars` | Same as Cloudflare |

The header wordmark splits on the last word and colors it in the accent color. For example, `My Coloring App` renders as `My Coloring` + `App` (colored).

---

## 🔀 Reverse Proxy Setup

When running behind a reverse proxy, expose the app on a subdomain or path without opening port 3000 publicly. The app has no special requirements — it's a standard HTTP server with no WebSocket connections.

---

### Caddy

Caddy handles HTTPS automatically via Let's Encrypt. Add this to your `Caddyfile`:

```caddyfile
colorcraft.yourdomain.com {
    reverse_proxy colorcraft-studio:3000
}
```

If Caddy is running in the same Docker network as the app, use the container name (`colorcraft-studio`) as the upstream host. If Caddy is on the host, use `localhost:3000`.

To put the app at a path rather than a subdomain:

```caddyfile
yourdomain.com {
    handle /colorcraft/* {
        uri strip_prefix /colorcraft
        reverse_proxy colorcraft-studio:3000
    }
}
```

---

### Traefik

Add labels to the container in your `docker-compose.yml`. Traefik must be running and connected to the same Docker network.

```yaml
services:
  colorcraft:
    image: ghcr.io/bangsmackpow/colorcraft-studio:latest
    container_name: colorcraft-studio
    restart: unless-stopped
    # Remove the ports: block when using Traefik — Traefik routes directly to the container
    environment:
      - NODE_ENV=production
      - APP_NAME=ColorCraft Studio
      - GEMINI_API_KEY=your_key_here
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

Replace `traefik-public` with the name of your existing Traefik network, and `letsencrypt` with your cert resolver name if different.

---

### Nginx Proxy Manager

Nginx Proxy Manager (NPM) is configured through its web UI — no config files needed.

1. In NPM, go to **Proxy Hosts → Add Proxy Host**
2. Fill in the **Details** tab:
   - **Domain Names:** `colorcraft.yourdomain.com`
   - **Scheme:** `http`
   - **Forward Hostname / IP:** `colorcraft-studio` (container name) or your server's local IP
   - **Forward Port:** `3000`
   - Enable **Block Common Exploits**
3. On the **SSL** tab:
   - Select **Request a new SSL Certificate**
   - Enable **Force SSL** and **HTTP/2 Support**
   - Agree to the Let's Encrypt terms of service
4. Click **Save**

NPM will obtain a certificate and your app will be live at `https://colorcraft.yourdomain.com`.

> **Note:** For NPM to reach the container by name, NPM and the ColorCraft container must be on the same Docker network. In Portainer, add the NPM network to the stack or use your server's local IP as the forward hostname instead.

---

## 💻 Local Development

### With Node.js (Express server)

```bash
git clone https://github.com/bangsmackpow/colorcraft-studio.git
cd colorcraft-studio

npm install

cp .env.example .env
# Edit .env — add GEMINI_API_KEY if you have one, set APP_NAME if desired

npm start        # http://localhost:3000
npm run dev      # same, but restarts automatically when files change
```

### With Wrangler (Cloudflare runtime)

```bash
cp .env.example .dev.vars
# Edit .dev.vars with your values

wrangler pages dev public --compatibility-date=2024-09-23
# http://localhost:8788
```

Use Wrangler local dev when testing changes to `functions/api/convert.js`. Use `npm run dev` for everything else — it's faster to iterate.

---

## Environment Variables

All environment variables are optional. The app runs without any of them.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the Express server listens on (Docker / local only) |
| `APP_NAME` | `ColorCraft Studio` | App name shown in the header and browser tab |
| `GEMINI_API_KEY` | *(empty)* | Enables AI coloring tips. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model to use. Change if your account has access to a different model |
| `BUCKET` | *(empty)* | Cloudflare R2 bucket binding name (Cloudflare only) |
| `PUBLIC_R2_URL` | *(empty)* | Public URL of your R2 bucket (Cloudflare only) |

**Setting variables:**

- **Docker / Portainer** — set in the `environment:` block of your compose file, or in a `.env` file alongside `docker-compose.yml`
- **Cloudflare Pages** — use `wrangler pages secret put VARIABLE_NAME` or the Cloudflare dashboard
- **Local Express** — set in `.env` (copy from `.env.example`)
- **Local Wrangler** — set in `.dev.vars` (copy from `.env.example`)

---

## Project Structure

```
colorcraft-studio/
├── public/
│   └── index.html              # Entire frontend — UI, canvas renderer, styles
│                               # Shared between Docker and Cloudflare deployments
├── server/
│   └── server.js               # Express server for Docker / local deployment
│                               # Serves static files + handles POST /api/convert
├── functions/
│   └── api/
│       └── convert.js          # Cloudflare Pages Function
│                               # Same logic as server.js, Workers runtime
├── .github/
│   └── workflows/
│       └── docker-build.yml    # GitHub Actions — builds and pushes image to
│                               # ghcr.io on every push to main
├── Dockerfile                  # Two-stage Node 20 Alpine build
├── docker-compose.yml          # Portainer / Docker Compose stack definition
├── wrangler.toml               # Cloudflare Pages / Workers configuration
├── package.json                # Node dependencies (express, multer)
├── .env.example                # Template for local .env / .dev.vars
└── .gitignore
```

**Two server files, one frontend.** `server/server.js` and `functions/api/convert.js` do the same job: validate the uploaded image, optionally call Gemini for coloring tips, and return the result. The actual coloring page is rendered entirely in the browser via Canvas — the server never processes the image pixels.

---

## Print Sizes

| Option | Dimensions | Notes |
|---|---|---|
| Full page | 8.5 × 11" | Standard US Letter — fits one image per page |
| Half page landscape | 11 × 4.25" | Print two per sheet, cut horizontally |
| Half page portrait | 5.5 × 8.5" | Print two per sheet, cut vertically |
| Quarter page | 5.5 × 4.25" | Print four per sheet |
| A4 | 210 × 297mm | Standard international paper size |

All sizes render at 150 DPI. The image is fitted and centered on the page with white letterboxing so nothing is cropped.

---

## Coloring Styles

| Style | Line Weight | Best For |
|---|---|---|
| **Clean Outlines** | Medium | Classic coloring book look, all skill levels |
| **Detailed Line Art** | Thin | Outlines plus internal detail lines for shading guidance |
| **Bold & Simple** | Thick | Young children, beginners, images with large shapes |
| **Intricate Detail** | Very thin | Advanced colorists, photos with fine texture and pattern |

Line weight and detail level can be further adjusted with the sliders regardless of style.

---

## Roadmap

- [ ] User accounts and saved conversion history
- [ ] Free tier with paid plans via Stripe
- [ ] Batch ZIP download
- [ ] Custom watermark option

---

## License

MIT
