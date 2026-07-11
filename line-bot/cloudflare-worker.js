/**
 * LINE → Firebase bridge for the Loan Assistant dashboard.
 *
 * Deploy as a Cloudflare Worker (free). It receives LINE group messages,
 * pulls out "+30 lunch" / "-10 paid back" style entries, and writes them to
 * the same Firebase Realtime Database room your dashboard reads — so the
 * dashboard updates live, no manual import.
 *
 * ── Configuration ────────────────────────────────────────────────────────
 * Set these as Worker *Variables and Secrets* in the Cloudflare dashboard
 * (Settings → Variables), OR just edit the fallbacks in CONFIG below.
 *
 *   LINE_CHANNEL_SECRET        (required) verifies requests really come from LINE
 *   FIREBASE_DB_URL            (required) e.g. https://your-proj-default-rtdb.firebaseio.com
 *   ROOM                       (required) the same room code you use in the dashboard
 *   LINE_CHANNEL_ACCESS_TOKEN  (optional) if set, the bot replies in the group
 *   TIMEZONE                   (optional) IANA tz for message times, default Asia/Bangkok
 *
 * See SETUP.md for the full walkthrough.
 */

const CONFIG = {
  LINE_CHANNEL_SECRET: "",        // ← or set as a Worker secret
  FIREBASE_DB_URL: "",            // ← e.g. https://loan-xxxx-default-rtdb.firebaseio.com
  ROOM: "",                       // ← same as the dashboard's room code
  LINE_CHANNEL_ACCESS_TOKEN: "",  // ← optional (enables replies)
  TIMEZONE: "Asia/Bangkok",
};

function cfg(env, key) {
  return (env && env[key] != null && env[key] !== "") ? env[key] : CONFIG[key];
}

export default {
  async fetch(request, env) {
    // Health check / LINE "Verify" button sends a GET or empty POST.
    if (request.method !== "POST") {
      return new Response("Loan Assistant LINE bot is running.", { status: 200 });
    }

    const body = await request.text();

    // 1) Verify the request is genuinely from LINE (HMAC-SHA256, base64).
    const secret = cfg(env, "LINE_CHANNEL_SECRET");
    const signature = request.headers.get("x-line-signature");
    if (secret) {
      const ok = await verifySignature(body, signature, secret);
      if (!ok) return new Response("Bad signature", { status: 401 });
    }

    let payload;
    try { payload = JSON.parse(body); } catch { return new Response("ok"); }
    const events = payload.events || [];

    const dbUrl = cfg(env, "FIREBASE_DB_URL").replace(/\/$/, "");
    const room = sanitizeRoom(cfg(env, "ROOM"));
    const token = cfg(env, "LINE_CHANNEL_ACCESS_TOKEN");
    const tz = cfg(env, "TIMEZONE") || "Asia/Bangkok";

    for (const ev of events) {
      if (ev.type !== "message" || !ev.message || ev.message.type !== "text") continue;

      const entry = parseMessage(ev.message.text, ev.timestamp, tz);
      if (!entry) continue;

      // 2) Write to Firebase (same shape the dashboard expects).
      await fetch(`${dbUrl}/rooms/${room}/entries.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });

      // 3) Optionally reply in the group with the new running balance.
      if (token && ev.replyToken) {
        const bal = await currentBalance(dbUrl, room);
        const text = entry.amt < 0
          ? `Recorded −${Math.abs(entry.amt)}. Balance: ${fmtBalance(bal)}`
          : `Recorded +${entry.amt}. Balance: ${fmtBalance(bal)}`;
        await replyLine(token, ev.replyToken, text);
      }
    }

    return new Response("ok");
  },
};

/** Parse one chat message into {amt, note, tm, t} or null. */
function parseMessage(text, timestampMs, tz) {
  if (!text) return null;
  const m = text.match(/([+\-−])\s*(\d+(?:\.\d+)?)/); // + - or − (unicode minus)
  if (!m) return null;
  const amt = parseFloat(m[2]);
  if (!amt) return null;
  const sign = m[1] === "+" ? 1 : -1;
  const note = (text.slice(0, m.index) + text.slice(m.index + m[0].length))
    .replace(/\s+/g, " ").trim();
  return {
    amt: sign * amt,
    note,
    tm: formatTime(timestampMs, tz),
    t: (timestampMs || Date.now()) * 1000, // matches dashboard's sort scale
  };
}

function formatTime(ms, tz) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz,
    }).format(new Date(ms || Date.now()));
  } catch { return ""; }
}

function sanitizeRoom(room) {
  return String(room || "").replace(/[.#$\[\]\/]/g, "_");
}

/** LINE signature = Base64( HMAC-SHA256(channelSecret, rawBody) ). */
async function verifySignature(body, signature, secret) {
  if (!signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function currentBalance(dbUrl, room) {
  try {
    const res = await fetch(`${dbUrl}/rooms/${room}/entries.json`);
    const val = await res.json();
    if (!val) return 0;
    return Object.values(val).reduce((s, e) => s + (Number(e.amt) || 0), 0);
  } catch { return 0; }
}

function fmtBalance(bal) {
  if (bal === 0) return "settled 🎉";
  return (bal > 0 ? "+" : "−") + Math.abs(Math.round(bal * 100) / 100);
}

async function replyLine(token, replyToken, text) {
  try {
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
    });
  } catch { /* ignore reply failures */ }
}
