# ClearCommute 🚇

AI-powered MTA crowd intelligence. Beat the rush on every subway, bus, LIRR, Metro-North, PATH, and Staten Island Railway line.

## Deploy in 5 minutes

### 1. Clone & install

```bash
git clone <your-repo-url>
cd clearcommute
npm install
```

### 2. Add your Anthropic API key

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Get your key at [console.anthropic.com](https://console.anthropic.com)

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

When prompted, add your environment variable:
- Key: `ANTHROPIC_API_KEY`
- Value: your key from console.anthropic.com

Or set it in the Vercel dashboard: **Project → Settings → Environment Variables**

## How it works

- The form sends your route details to `/api/analyze` (a Next.js server route)
- The server calls Claude using your secret API key — it never touches the browser
- Claude returns crowd scores, timeline data, departure suggestions, and route-specific tips
- Results render instantly in the UI

## Features

- All MTA lines: NYC Subway, MTA Bus, LIRR, Metro-North, Staten Island Railway, PATH
- AI crowd forecast (0–100%) for any route, time, and day
- 2-hour crowd timeline visualization
- 3 departure time suggestions (best / acceptable / busy)
- Route-specific insider tips
- Dark mode support
- Mobile responsive
