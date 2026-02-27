# ColorCraft Studio

Convert photos into printable coloring book pages. Supports 4 line-art styles, before/after comparison, PNG download, and print-to-PDF. AI coloring tips powered by Gemini (optional).

---

## Deployment Options

| Method | Best for |
|---|---|
| **Docker / Portainer** | Self-hosted, your own server |
| **Cloudflare Pages** | Free global CDN hosting |
| **Local dev** | Development and testing |

---

## 🐳 Docker / Portainer

### Quick start with Portainer

1. In Portainer, go to **Stacks → Add Stack**
2. Name it `colorcraft-studio`
3. Paste this into the compose editor:

```yaml
version: "3.8"

services:
  colorcraft:
    image: colorcraft-studio:latest
    build:
      context: https://github.com/YOUR_USERNAME/colorcraft-studio.git
      dockerfile: Dockerfile
    container_name: colorcraft-studio
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - GEMINI_API_KEY=your_key_here
      - GEMINI_MODEL=gemini-2.0-flash
```

4. Click **Deploy the stack**
5. Open `http://your-server-ip:3000`

> **Gemini API key** is optional — get one free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Without it the app still works; you just won't get AI coloring tips.

---

### Build and run locally with Docker

```bash
git clone https://github.com/YOUR_USERNAME/colorcraft-studio.git
cd colorcraft-studio

cp .env.example .env        # then edit .env and add your GEMINI_API_KEY

docker compose up --build   # http://localhost:3000
```

Useful commands:

```bash
docker compose up --build -d   # run in background
docker compose down            # stop
docker compose logs -f         # stream logs
```

---

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | Port the server listens on |
| `GEMINI_API_KEY` | No | *(empty)* | Gemini API key for AI tips |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | Which Gemini model to use |

---

## ☁️ Cloudflare Pages (free global hosting)

```bash
npm install -g wrangler && wrangler login

wrangler pages project create colorcraft-studio
wrangler pages secret put GEMINI_API_KEY --project-name colorcraft-studio
wrangler pages deploy public --project-name colorcraft-studio
```

Live at `https://colorcraft-studio.pages.dev`. Redeploy anytime with the last command.

---

## 💻 Local development (no Docker)

```bash
git clone https://github.com/YOUR_USERNAME/colorcraft-studio.git
cd colorcraft-studio

npm install
cp .env.example .env    # add GEMINI_API_KEY if you have one

npm start               # http://localhost:3000
npm run dev             # same but auto-restarts on file changes
```

---

## Project structure

```
colorcraft-studio/
├── public/
│   └── index.html          # Frontend — UI, canvas renderer, all styles
├── server/
│   └── server.js           # Express server (Docker / local deployment)
├── functions/
│   └── api/
│       └── convert.js      # Cloudflare Pages Function (CF deployment)
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

`server/server.js` and `functions/api/convert.js` do the same job — validate uploads and optionally call Gemini for tips. Use whichever matches your deployment. The frontend is shared between both.

---

## How it works

1. **Upload a photo** — drag and drop, or click to browse
2. **Canvas edge detection runs in your browser** — the Sobel algorithm extracts outlines locally, no image sent to a server for the conversion
3. **Gemini tips load in the background** — the coloring page is ready before tips arrive
4. **Download PNG** or **print to PDF** directly from the browser

---

## Coloring styles

| Style | Description |
|---|---|
| **Clean Outlines** | Bold simple lines — classic coloring book look |
| **Detailed Line Art** | Outlines + internal detail lines |
| **Bold & Simple** | Thick lines, large shapes — great for beginners |
| **Intricate Detail** | Fine lines, maximum detail — for advanced colorists |

---

## Roadmap

- [ ] User accounts + saved history
- [ ] Free tier with paid plans (Stripe)
- [ ] Higher resolution output for professional print
- [ ] Batch ZIP download

---

## License

MIT
