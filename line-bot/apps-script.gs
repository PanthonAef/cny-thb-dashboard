/**
 * LINE → Firebase bridge (Google Apps Script version).
 *
 * The simplest free option: no CLI, no account beyond Google. Paste this into
 * script.google.com, fill CONFIG, deploy as a Web App, and use that URL as the
 * LINE webhook. Writes entries to the same Firebase room your dashboard reads.
 *
 * NOTE: Apps Script Web Apps cannot read request headers, so the LINE
 * "x-line-signature" cannot be verified here. The webhook URL is long and
 * secret, which is usually fine for a personal loan tracker — but if you want
 * real signature verification, use cloudflare-worker.js instead.
 *
 * See SETUP.md for the full walkthrough.
 */

var CONFIG = {
  FIREBASE_DB_URL: "",   // e.g. https://loan-xxxx-default-rtdb.firebaseio.com
  ROOM: "",              // same room code as the dashboard
  TIMEZONE: "Asia/Bangkok",
};

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var events = payload.events || [];
    var dbUrl = CONFIG.FIREBASE_DB_URL.replace(/\/+$/, "");
    var room = String(CONFIG.ROOM).replace(/[.#$\[\]\/]/g, "_");

    events.forEach(function (ev) {
      if (ev.type !== "message" || !ev.message || ev.message.type !== "text") return;
      var entry = parseMessage(ev.message.text, ev.timestamp);
      if (!entry) return;
      UrlFetchApp.fetch(dbUrl + "/rooms/" + room + "/entries.json", {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(entry),
        muteHttpExceptions: true,
      });
    });
  } catch (err) {
    // swallow — always 200 so LINE doesn't retry forever
  }
  return ContentService.createTextOutput("ok");
}

function doGet() {
  return ContentService.createTextOutput("Loan Assistant LINE bot is running.");
}

function parseMessage(text, timestampMs) {
  if (!text) return null;
  var m = text.match(/([+\-−])\s*(\d+(?:\.\d+)?)/); // + - or − (unicode minus)
  if (!m) return null;
  var amt = parseFloat(m[2]);
  if (!amt) return null;
  var sign = m[1] === "+" ? 1 : -1;
  var note = (text.slice(0, m.index) + text.slice(m.index + m[0].length))
    .replace(/\s+/g, " ").trim();
  var tm = "";
  try {
    tm = Utilities.formatDate(new Date(timestampMs || Date.now()), CONFIG.TIMEZONE, "h:mm a");
  } catch (e) {}
  return {
    amt: sign * amt,
    note: note,
    tm: tm,
    t: (timestampMs || Date.now()) * 1000, // matches dashboard's sort scale
  };
}
