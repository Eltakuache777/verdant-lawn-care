# Setup Guide — Getting Greenline Running for Real

This app needs five real accounts before anything works live. Do them in this order.

## 1. A code editor + Node.js (do this first)
- Install [VS Code](https://code.visualstudio.com/) (free)
- Install [Node.js](https://nodejs.org/) (choose the "LTS" version)
- Open this project folder in VS Code, then in its terminal run: `npm install`

## 2. Database — Neon (free tier works fine to start)
1. Go to https://neon.tech and sign up
2. Create a new project
3. Copy the "Connection string" it gives you
4. Paste it into `.env.local` as `DATABASE_URL`
5. In your terminal: `npm run db:push` — this creates all your real tables

*(Supabase is a fine alternative if you'd rather use that — same idea, different dashboard.)*

## 3. Stripe — real payments
1. Go to https://dashboard.stripe.com/register and sign up
2. Stay in **Test mode** while building (toggle top-right of dashboard)
3. Go to Developers → API keys → copy the "Secret key" into `.env.local` as `STRIPE_SECRET_KEY`, and the "Publishable key" into `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
4. Go to Developers → Webhooks → Add endpoint → URL: `https://your-deployed-url.com/api/webhook` → select event `checkout.session.completed` → copy the "Signing secret" into `STRIPE_WEBHOOK_SECRET`
5. When you're ready to take real money, flip to Live mode and repeat step 3-4 with live keys, and connect your real bank account under Settings → Payouts

## 4. Google Maps Platform — address autocomplete + lawn measuring
1. Go to https://console.cloud.google.com and create a project
2. Enable these three APIs: **Geocoding API**, **Maps JavaScript API**, **Places API**
3. Go to APIs & Services → Credentials → Create API key
4. Paste it into `.env.local` as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
5. **Important:** click "Restrict key" and limit it to your domain once deployed, or anyone could rack up charges on your key
6. This has a free monthly credit, then charges per request — check current pricing at https://mapsplatform.google.com/pricing/ before launch

## 5. Anthropic API — the AI booking assistant
1. Go to https://console.anthropic.com and sign up
2. Go to API Keys → Create key
3. Paste it into `.env.local` as `ANTHROPIC_API_KEY`
4. Add billing under Settings → Billing so the key can make real calls

## 6. Stability AI — AI design concept generation
1. Go to https://platform.stability.ai and sign up
2. Go to API Keys → Create key
3. Paste it into `.env.local` as `STABILITY_API_KEY`
4. New accounts get some free credits; add more under Billing when you're ready for real customers — each generated concept image costs a few credits
5. `/design` lets customers upload a photo + description, pay via Stripe ($50/$70/$120 tiers), then real AI-generated concepts appear on `/design/success`

## 7. Hosting — Vercel (built by the same team as Next.js, easiest fit)
1. Push this project to a GitHub repository
2. Go to https://vercel.com, sign up, and "Import" your repository
3. In Vercel's project settings, add every variable from `.env.local` under "Environment Variables"
4. Deploy — Vercel gives you a live URL immediately
5. Go back to Stripe's webhook settings (step 3.4) and update the URL to your real Vercel URL

## Running it locally before you deploy
```
npm install
npm run db:push
npm run dev
```
Then open http://localhost:3000

## Admin password
`/admin` and price editing are protected by HTTP Basic Auth. Set `ADMIN_PASSWORD` in `.env.local` to whatever you want your login password to be — the browser will prompt for a username (anything works) and that password the first time you visit `/admin`.

## File uploads (chat photo/video attachments)
Customer chat attachments are currently saved to `public/uploads/` on local disk — fine for running locally, but **won't work on serverless hosts like Vercel** (no persistent disk there). Before deploying for real, swap `app/api/upload/route.ts` to use real cloud storage (Vercel Blob, S3, Cloudinary, etc.).

## AI assistant web search
The booking assistant (`app/api/assistant/route.ts`) can now search the web for current prices on specific materials/plants/trees a customer asks about that aren't in your Materials price list — it uses Anthropic's own web search tool, so no new account is needed, but each search adds a small extra charge on your Anthropic bill (roughly $0.01/search) on top of normal token costs.

## What's real vs. what's still a placeholder in this codebase
- ✅ Real: database, booking creation (supports multiple services + plan preference), price editing (password-protected), Stripe checkout + webhook, Claude-powered assistant with real tool calls, Google geocoding + lawn-boundary/fence/pressure-washing map measuring tools, admin schedule view, public availability calendar, SendGrid email confirmations, private customer↔admin chat with photo/video attachments, admin-maintained materials price list, AI design concept generation (Stability AI) with real Stripe payment
- ⚠️ Placeholder: SMS confirmations (needs Twilio)
- ⚠️ Known limitation: uploaded photos/videos (chat + design requests) save to local disk — fine for local dev, needs real cloud storage (Vercel Blob, S3, Cloudinary) before deploying somewhere serverless like Vercel. The `/api/quote/generate` route also runs a whole concept batch synchronously in one request — fine locally, but the 15/50-concept tiers risk timing out on a serverless host's function duration limit; a real deployment should move this to a background job/queue.

Tell me which of these you want built next and I'll keep going.
