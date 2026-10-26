# Vercel frontend

This directory is the Vercel project root. Import the parent GitHub repository into Vercel, select **Root Directory: `vercel`**, and use the Next.js preset.

```bash
npm install
npm run dev
```

For production validation, run `npm run build` and `npm start`.

No environment variables are required for the default setup. The `/api/game` rewrite in `vercel.json` forwards requests to the existing public backend, which must remain active. Room data stays in Cloudflare D1. See the repository's main README and `docs/DEPLOYMENT.md` for the full architecture and instructions.
