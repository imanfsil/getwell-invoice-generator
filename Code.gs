/**
 * Getwell Invoice Generator — shared daily invoice number allocator.
 *
 * Use this as a container-bound script for a Google Sheet.
 * It stores daily counters in the "Counters" sheet and an audit record for
 * each allocation in the "Invoice Log" sheet. LockService serializes requests.
 */
const TIME_ZONE = "Asia/Kuala_Lumpur";
const COUNTERS_TAB = "Counters";
const LOG_TAB = "Invoice Log";

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "";
  if (action === "health") {
    return json_({ ok: true, service: "Getwell Invoice Numbering", timeZone: TIME_ZONE });
  }
  if (action === "reserveNumber") {
    let result;
    try {
      result = reserveInvoiceNumber_();
    } catch (error) {
      result = { ok: false, error: String(error && error.message || error) };
    }
    const callback = (e && e.parameter && e.parameter.callback) || "";
    if (callback) {
      // Restrict callback to a simple JavaScript identifier to prevent script injection.
      if (!/^[A-Za-z_$][0-9A-Za-z_$]{0,100}$/.test(callback)) {
        return ContentService.createTextOutput("/* Invalid callback */")
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(callback + "(" + JSON.stringify(result) + ");")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return json_(result);
  }
  return json_({ ok: false, error: "Unknown action. Use action=health or action=reserveNumber." });
}

function setupInvoiceCounter() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Open Apps Script from the Google Sheet using Extensions > Apps Script.");
  ss.setSpreadsheetTimeZone(TIME_ZONE);

  let counters = ss.getSheetByName(COUNTERS_TAB);
  if (!counters) counters = ss.insertSheet(COUNTERS_TAB);
  if (counters.getLastRow() === 0) {
    counters.appendRow(["Date Key (DDMMYYYY)", "Last Sequence", "Updated At (MYT)"]);
    counters.setFrozenRows(1);
  }

  let log = ss.getSheetByName(LOG_TAB);
  if (!log) log = ss.insertSheet(LOG_TAB);
  if (log.getLastRow() === 0) {
    log.appendRow(["Invoice Number", "Date Key", "Sequence", "Reserved At (MYT)", "Status"]);
    log.setFrozenRows(1);
  }
  Logger.log("Getwell invoice counter initialized: " + ss.getUrl());
}

function reserveInvoiceNumber_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error("Counter spreadsheet not found. Bind this script to the clinic's Google Sheet.");
    const counters = ss.getSheetByName(COUNTERS_TAB);
    const log = ss.getSheetByName(LOG_TAB);
    if (!counters || !log) throw new Error("Sheets are not initialized. Run setupInvoiceCounter() first.");

    const now = new Date();
    const dateKey = Utilities.formatDate(now, TIME_ZONE, "ddMMyyyy");
    const lastRow = counters.getLastRow();
    let counterRow = 0;
    let current = 0;

    if (lastRow >= 2) {
      const keys = counters.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
      for (let i = 0; i < keys.length; i++) {
        if (String(keys[i][0]).trim() === dateKey) {
          counterRow = i + 2;
          current = Number(counters.getRange(counterRow, 2).getValue()) || 0;
          break;
        }
      }
    }

    const next = current + 1;
    if (counterRow) {
      counters.getRange(counterRow, 2, 1, 2).setValues([[next, now]]);
    } else {
      counters.appendRow([dateKey, next, now]);
    }
    const invoiceNumber = "#" + dateKey + "-" + next;
    log.appendRow([invoiceNumber, dateKey, next, now, "RESERVED"]);
    SpreadsheetApp.flush();

    return {
      ok: true,
      invoiceNumber: invoiceNumber,
      sequence: next,
      dateKey: dateKey,
      createdAt: Utilities.formatDate(now, TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ss"),
      timeZone: TIME_ZONE
    };
  } finally {
    lock.releaseLock();
  }
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
