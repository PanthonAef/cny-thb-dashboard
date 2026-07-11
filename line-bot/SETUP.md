# Live LINE → Dashboard setup

Make your **Loan Assistant** dashboard update automatically whenever someone
posts `+30 lunch` or `-10 paid back` in your LINE group — no more manual import.

```
LINE group ──► LINE bot ──► webhook (Cloudflare/Apps Script) ──► Firebase ──► dashboard (live)
```

Everything here is **free**. You'll do this once (~15–20 min). Steps you can't
skip are marked ⚠️.

---

## Part 1 — Firebase (shared database)

If you already set up **Shared sync** in the dashboard, you have this — just
reuse the same **config** and **room code**, and skip to Part 2.

1. Go to [console.firebase.google.com](https://console.firebase.google.com/) → **Add project** (skip Analytics).
2. **Build → Realtime Database → Create Database** → pick a location → **Start in test mode**.
3. ⚠️ Copy your **database URL** — it looks like `https://loan-xxxx-default-rtdb.firebaseio.com`.
4. Set database **rules** so the bot can write. In **Realtime Database → Rules**, use:
   ```json
   { "rules": { ".read": true, ".write": true } }
   ```
   > This makes the data readable/writable by anyone who knows the URL **and** your
   > room path. Fine for lunch money; use a hard-to-guess room code. (Test mode
   > works too but expires after 30 days — these rules are permanent.)
5. Open the dashboard → ⚙ **Settings → Shared sync**, paste the Firebase config,
   pick a **room code** (e.g. `me-tan-2026`), tap **Connect**. Use this exact room
   code in Part 3.

---

## Part 2 — Create the LINE bot

1. Go to [developers.line.biz](https://developers.line.biz/) → log in → **Create a provider** (any name).
2. **Create a new channel → Messaging API**. Fill the basics.
3. In the channel:
   - **Basic settings** tab → ⚠️ copy the **Channel secret**.
   - **Messaging API** tab → ⚠️ issue and copy the **Channel access token (long-lived)**.
4. ⚠️ In **Messaging API** tab, turn settings so the bot can listen in groups:
   - **Use webhook**: **Enabled**
   - **Auto-reply messages**: **Disabled**
   - **Greeting messages**: optional
   - **Allow bot to join group chats**: **Enabled**

You'll paste the webhook URL here after Part 3.

---

## Part 3 — Deploy the webhook

Pick **ONE** host. Cloudflare is recommended (verifies LINE signatures); Apps
Script is the simplest.

### Option A — Cloudflare Worker (recommended)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com/) → **Workers & Pages → Create → Create Worker** → deploy the starter.
2. Open the Worker → **Edit code**. Delete the sample and paste all of
   [`cloudflare-worker.js`](./cloudflare-worker.js). **Deploy**.
3. Worker → **Settings → Variables and Secrets** → add:

   | Name | Value | Type |
   |---|---|---|
   | `LINE_CHANNEL_SECRET` | your Channel secret | Secret (encrypt) |
   | `FIREBASE_DB_URL` | your database URL | Text |
   | `ROOM` | your room code (same as dashboard) | Text |
   | `LINE_CHANNEL_ACCESS_TOKEN` | Channel access token *(optional — enables the bot replying in the group)* | Secret |

   (Or just edit the `CONFIG` block at the top of the file instead of using variables.)
4. **Deploy** again. Copy the Worker URL: `https://your-worker.your-name.workers.dev`.

### Option B — Google Apps Script (simplest)

1. Go to [script.google.com](https://script.google.com/) → **New project**.
2. Paste all of [`apps-script.gs`](./apps-script.gs). Fill the `CONFIG` block
   (`FIREBASE_DB_URL`, `ROOM`).
3. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Authorize, then **copy the Web app URL** (ends in `/exec`).
   > Note: Apps Script can't verify LINE signatures (it can't read request
   > headers). The secret URL is your protection. Use Cloudflare if you want
   > signature verification.

---

## Part 4 — Connect LINE to your webhook

1. Back in the LINE channel → **Messaging API → Webhook URL** → paste your
   Worker/Apps Script URL → **Update** → **Verify** (should say Success).
2. ⚠️ Add the bot to your LINE group: open the group → **invite** your bot
   (search the bot's Basic ID / add it as a friend first via its QR code, then invite to the group).

---

## Part 5 — Test

In the LINE group, send:

```
+30 lunch
```

Within a second or two it should appear on the dashboard, and the balance
updates. Send `-10 paid back` to see a repayment. Done! 🎉

- **+N** = the borrower borrowed N
- **−N** = the borrower repaid N
- Messages without a `+`/`−` number are ignored.

---

## Notes

- **Cost:** LINE Messaging API is free to *receive* messages; Cloudflare Workers
  and Apps Script both have free tiers well above what a 2-person chat needs.
- **Manual import still works** as a backup — but note it *replaces* the room's
  data, so avoid importing after the bot has been running (it would overwrite
  the bot's live entries). Use one or the other as the source of truth.
- **Privacy:** anyone with the Firebase URL + room code can read/write. Keep the
  room code private; don't store anything sensitive.
- **Two phones:** both people just open the dashboard with the same Firebase
  config + room code — both see the live data.
