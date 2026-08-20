# Ritham · Gau Seva — landing page + on-site payments

A static landing page (`index.html`) for the Gau Seva seva campaign, with an
**on-site Razorpay checkout** wired to Supabase edge functions — exactly like the
Sawan puja flow (no hosted payment links). Lives at **ritham.co.in/gauseva/**.

## How payment works (same pattern as the Sawan puja)

1. The visitor taps **Book Seva** on a tier → a small modal collects **name +
   WhatsApp number**.
2. The page calls **`gau-seva-create-order`** (Supabase edge fn) with the tier
   amount. The server **recomputes the amount** from the fixed seva ladder
   (₹11→1, ₹51→5, ₹101→11, ₹251→31, ₹501→51 — the client price is never
   trusted), creates a Razorpay order, and writes a `pending_payment` row in
   `gau_seva_bookings`.
3. **Razorpay Checkout** opens on the page (UPI / cards).
4. On success the page calls **`gau-seva-verify-payment`**, which verifies the
   HMAC signature, flips the booking to **`Payment Successful`**, sends the
   **WhatsApp welcome** (proof-video-in-7-days), and fires Meta `Purchase`.
5. **`gau-seva-webhook`** is the server-to-server fallback (Razorpay
   `payment.captured`) for when the browser is torn down during the UPI hop — it
   does the same idempotent flip + WhatsApp + Purchase. Verify and webhook are
   safely redundant (only the first flip sends).

There are **no payment links to paste.** The Supabase URL + public anon key are
already inlined in `index.html` (same key the rest of the site uses; safe — all
access is enforced server-side).

## Deploy the backend (in the `ritham` repo — you deploy)

1. **Apply migration** `supabase/migrations/034_gau_seva_bookings.sql`
   (`supabase db push`, or paste into the SQL editor).
2. **Deploy the three functions:**
   ```
   supabase functions deploy gau-seva-create-order
   supabase functions deploy gau-seva-verify-payment
   supabase functions deploy gau-seva-webhook --no-verify-jwt
   ```
   (Or paste each `index.ts` into the Supabase dashboard, like the sawan-* fns.)
3. **Razorpay keys** — `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` are already set
   (shared with the app + Sawan puja), so create-order/verify work immediately.
4. **Webhook:** Razorpay Dashboard → Settings → Webhooks → add
   `https://eaxdqizerkuqkujxacru.supabase.co/functions/v1/gau-seva-webhook`,
   event **`payment.captured`**, set a secret → store as **`GAU_WEBHOOK_SECRET`**.
5. **WhatsApp welcome** (optional but requested) — set `WHATSAPP_TOKEN` +
   `WHATSAPP_PHONE_NUMBER_ID`, and **create/get approved** a template named
   `gau_seva_welcome` (category *Utility*), body e.g.:
   > 🙏 Namaste {{1}}, your Gau Seva ({{2}} Seva) is received. Your proof video of the seva will be delivered to you within **7 days**. Gau Mata ki jai!

   Two body variables: `{{1}}` = name, `{{2}}` = seva count. Business-initiated
   WhatsApp messages *require* an approved template. Until the token is set, the
   welcome is a safe no-op (payments still work).
6. **Meta CAPI** (optional) — set `META_CAPI_TOKEN` to activate the server-side
   `Purchase` / `InitiateCheckout`.

## Placeholders still to replace in `index.html`

| Placeholder | Where | What to put |
|---|---|---|
| `PIXEL_ID` | `<head>` Meta Pixel (4 spots) | Your Meta Pixel id (Ritham ad pixel: `1001713839547879`) |
| `WHATSAPP_NUMBER` | footer, final CTA, floating button (support chat) | Full international number, digits only — e.g. `919876543210` |

> The browser pixel fires `InitiateCheckout` (with the tier amount + an
> `eventID`) when checkout opens, and the server fires the deduped copy. The
> reliable **`Purchase`** is fired server-side from verify/webhook — no thank-you
> page needed (unlike hosted links).

## Images to add (in `gauseva/img/` and `gauseva/`)

| File | Used for | Notes |
|---|---|---|
| `img/gau-hero.jpg` | Hero image | Warm gau-seva photo, ~16:9, optimised WebP/JPG. |
| `img/gau-og.jpg` (optional) | Social share image | Update the `og:image` meta to its absolute URL. |

All images should be trimmed WebP / optimised JPG — never multi-MB PNGs.

## Admin — `gauseva/admin.html`

Self-contained (no build), `noindex`. Sign in with an owner account (same
`is_web_puja_admin` gate) to see every contribution — name, tappable WhatsApp,
amount, seva count, status, whether the welcome was sent — with totals (paid
only) and **CSV export**. Statuses: *Payment Successful → Video Sent*, and
*Refunded*. Reads `gau_seva_bookings` over RLS, so it works the moment migration
034 is applied.

## Terms

`gauseva/terms.html` — a paid **seva service** (not a donation; no 80G), the
7-day video delivery promise, payment, refunds/cancellation. Linked from the
page footer + the "Is this a donation?" FAQ.

## Enable GitHub Pages

The live site deploys from the separate **`ritham-website`** repo (its
`.github/workflows/static.yml` publishes `website/` to Pages on push to `main`).
Copy this `gauseva/` folder into that repo's `website/`, commit & push `main`,
then verify at `https://ritham.co.in/gauseva/`.
