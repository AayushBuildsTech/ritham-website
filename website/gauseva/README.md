# Ritham · Gau Seva — landing page

A single-file, static landing page (`index.html`) for the Gau Seva seva campaign.
No backend, no build step — GitHub Pages serves it as-is. Lives at **ritham.co.in/gauseva/**.

## Placeholders to replace (find-and-replace in `index.html`)

| Placeholder | Where | What to put |
|---|---|---|
| `PAYMENT_LINK_11` | ₹11 tier + (if selected) sticky bar | Hosted Razorpay Payment Page/Link URL for ₹11 |
| `PAYMENT_LINK_51` | ₹51 tier | Razorpay link for ₹51 |
| `PAYMENT_LINK_101` | ₹101 tier **and** the sticky-bar default `id="sb-go"` | Razorpay link for ₹101 |
| `PAYMENT_LINK_251` | ₹251 tier | Razorpay link for ₹251 |
| `PAYMENT_LINK_501` | ₹501 tier | Razorpay link for ₹501 |
| `WHATSAPP_NUMBER` | footer, final CTA, floating button (3+ spots) | Full international number, digits only — e.g. `919876543210` |
| `PIXEL_ID` | `<head>` Meta Pixel (4 spots: init, noscript img, + comment) | Your Meta Pixel id (Ritham ad pixel is `1001713839547879`) |

> Tip: `PAYMENT_LINK_101` appears **twice** (the tier card and the sticky-bar button default). Replace all.

## Image / video assets to add (in `gauseva/img/` and `gauseva/`)

| File | Used for | Notes |
|---|---|---|
| `img/gau-hero.jpg` | Hero image (above the fold) | Warm photo of gau seva / feeding cows. ~16:10. Optimise (WebP/JPG, trimmed). Loads eagerly. |
| `img/video-poster.jpg` | Proof-video poster | Small still; the video itself is `preload="none"` so only the poster loads until play. |
| `gau-seva-proof.mp4` | Sample proof video | A real short proof clip. Keep it small / compressed for slow-4G. |
| `img/gau-og.jpg` (optional) | Social share image | Update the `og:image` meta to its absolute URL. |

All images should be **trimmed WebP/optimised JPG** (small, fast) — never multi-MB PNGs.

## Meta Pixel / ads

- `PageView` fires on load; **`InitiateCheckout`** fires on every tier tap with `value` = the tier amount and `currency: INR`, so Ads Manager shows which tier converts.
- **The ad algorithm optimises on `Purchase`.** That event **cannot** fire on this static page — the buyer leaves for the hosted Razorpay page. You **must** add a `Purchase` pixel (same `PIXEL_ID`, `value` + `currency: INR`) on the Razorpay **thank-you / callback page**, or the campaign has nothing to optimise against. (Because real buyers' browser beacons often drop around the payment hand-off on mobile/in-app browsers, a server-side Conversions API Purchase is strongly recommended too — same approach already used for the Sawan puja.)

## Proof-video delivery promise

The page states in multiple places (hero, tiers note, proof section, How-it-works, FAQ, footer) that the **proof video is delivered within 7 days**. Keep this consistent with the post-payment WhatsApp welcome message.

## Backend — contributions DB + WhatsApp auto-welcome (you deploy)

The static page can't record contributions or send WhatsApp on its own, so a
single **Razorpay webhook** does both. Written & ready in the `ritham` repo:

- **`supabase/migrations/034_gau_seva_bookings.sql`** — the `gau_seva_bookings`
  table + RLS (only owner accounts, via the existing `is_web_puja_admin()`
  gate, can read; the webhook writes with the service role). Apply it (`supabase
  db push`, or paste in the SQL editor).
- **`supabase/functions/gau-seva-webhook/index.ts`** — on `payment.captured` it
  verifies the signature, inserts a booking (idempotent on payment id), sends
  the WhatsApp welcome (**promising the proof video within 7 days**), and fires
  Meta CAPI `Purchase`. Deploy with:
  `supabase functions deploy gau-seva-webhook --no-verify-jwt`

**Wire it up:**
1. Razorpay Dashboard → Settings → **Webhooks** → add the function URL
   (`https://eaxdqizerkuqkujxacru.supabase.co/functions/v1/gau-seva-webhook`),
   select event **`payment.captured`**, set a secret.
2. Set Supabase secrets:
   - `GAU_WEBHOOK_SECRET` (**required**) — the webhook secret from step 1.
   - `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` — Meta WhatsApp Cloud API
     (welcome send is a no-op until both are set).
   - `WHATSAPP_TEMPLATE_NAME` (default `gau_seva_welcome`), `WHATSAPP_TEMPLATE_LANG` (default `en`).
   - `META_CAPI_TOKEN` (optional) to activate the server-side Purchase.
3. **Create & get approved** a WhatsApp template named `gau_seva_welcome`
   (category *Utility*) with body text like:
   > 🙏 Namaste {{1}}, your Gau Seva ({{2}} Seva) is received. 🐄 Your proof video of the seva will be delivered to you within **7 days**. Gau Mata ki jai!

   Two body variables: `{{1}}` = name, `{{2}}` = seva count. (Business-initiated
   WhatsApp messages *require* an approved template — free text won't send.)

> Note: the Razorpay **Payment Page** should collect the contributor's name +
> phone. Phone comes through as the payment `contact`; put the name into the
> Payment Page fields / `notes` so it lands in the booking row.

## Admin — `gauseva/admin.html`

Self-contained (no build), served alongside the page, `noindex`. Sign in with an
owner account (same `is_web_puja_admin` gate as before) to see every
contribution: name, tappable WhatsApp, amount, seva count, status, whether the
welcome was sent, plus totals and **CSV export**. Statuses: *Payment Received →
Video Sent*, and *Refunded*. It reads `gau_seva_bookings` directly over RLS, so
it works the moment migration 034 is applied.

## Decommission the old Sawan puja campaign (your action on live)

The `/puja` + `/chadhava` **pages/files are deleted** here. The old campaign also
had live backend pieces that only *you* can remove (I only prepared local
files, per your choice). When ready, on Supabase / Razorpay:
- Remove/disable the `sawan-create-order`, `sawan-verify-payment`,
  `sawan-razorpay-webhook` edge functions and their Razorpay webhook.
- The `web_puja_bookings` data can be dropped once you've kept your CSV export.
  (Migration files 030–033 are left in place as schema history — drop the table
  via a new migration if you want it gone, rather than deleting past migrations.)
- The old puja admin lived under `/puja/` and is gone with that folder.

## Enable GitHub Pages

The live site deploys from the **separate `ritham-website` repo** (`.github/workflows/static.yml` publishes its `website/` subfolder to Pages on push to `main`). To go live:
1. Copy this `gauseva/` folder into the `ritham-website` repo's `website/` folder.
2. Commit & push to `main` → the Actions workflow rebuilds Pages (~1–2 min).
3. Verify at `https://ritham.co.in/gauseva/` (hard-refresh; add `?v=1` cache-buster if needed).

The custom domain (`CNAME` = ritham.co.in) and HTTPS are already configured for the site.

## Verify at 360px

Design is mobile-first for a 360px phone. Open DevTools, set width to 360px, and confirm:
tier cards stack vertically, the sticky contribute bar sits at the bottom, tap targets ≥ 44px,
and nothing overflows horizontally.
