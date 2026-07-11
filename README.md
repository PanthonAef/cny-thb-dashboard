# Loan Assistant

A tiny **AI-chatbot-style dashboard** that tracks money lent between two friends,
using the `+30` (borrow) / `-10` (repay) notes you already keep in a LINE chat.

## What's here

| File | What it is |
|---|---|
| [`loan-tracker.html`](./loan-tracker.html) | The dashboard. Open it in any browser — a single self-contained file. Shows the running balance (who owes whom), history, and a balance chart. Read-only: it **displays** data imported from LINE. |
| [`line-bot/`](./line-bot/) | Optional live integration — a LINE bot that reads your group messages and updates the dashboard automatically. See [`line-bot/SETUP.md`](./line-bot/SETUP.md). |

## Using it

**Quick / offline:** open `loan-tracker.html`, tap **Import from LINE**, and paste
or upload your LINE chat export. The dashboard adds it all up. Re-import to refresh.

**Shared across two phones:** in ⚙ Settings → **Shared sync**, connect a free
Firebase Realtime Database with a shared room code. Both people see the same data live.

**Fully automatic:** follow [`line-bot/SETUP.md`](./line-bot/SETUP.md) to add a LINE
bot — then every `+30`/`-10` posted in the group updates the dashboard instantly,
no manual import.

## Design

The UI follows the **UI/UX Pro Max** "AI-Native" style (conversational bubbles,
context cards, typing indicator, AI-purple palette, Space Grotesk + DM Sans).
Works in light and dark mode.
