# Risk Wizard (Vite + React + TS + Tailwind)

Mobile-friendly, light/dark mode ready, no-backend demo with the Interactive Risk Analysis Wizard.

## Quick Start

```bash
npm i
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Deploy

- **Vercel/Netlify**: Import this repo, select the Vite preset. Build command: `npm run build`, Output dir: `dist`.
- **Static hosting**: After `npm run build`, upload the `dist/` folder contents to any static host (S3, Cloudflare Pages, etc.).

## Features

- TailwindCSS with `darkMode: 'class'` and an Auto/Light/Dark toggle
- Mobile-safe layout with `viewport-fit=cover` and safe-area padding
- Recharts responsive charts
- No external data sources
