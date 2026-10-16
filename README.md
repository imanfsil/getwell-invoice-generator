# Getwell Invoice Generator — flat upload version

This version has no separate `assets/` folder. The logo and signature reference images are embedded directly inside `invoice.html` as data URIs, so you can upload the files directly to GitHub's root without preserving any folder structure.

## Upload to GitHub

Upload these four files:
- `invoice.html`
- `invoice.css`
- `invoice.js`
- `Code.gs` (this file is copied into the Google Apps Script editor; it does not need to be served by GitHub Pages)

For a clean GitHub Pages setup, create a repository named `getwell-invoice-generator`, upload the first three files to the repository root, and configure Pages to deploy from `main` / root. Open `https://YOUR-GITHUB-USERNAME.github.io/getwell-invoice-generator/invoice.html`.

## Important: shared numbering setup

`invoice.js` must contain the deployed Google Apps Script `/exec` URL. Replace `PASTE_YOUR_DEPLOYED_APPS_SCRIPT_WEB_APP_URL_HERE` after you deploy `Code.gs` as a web app.

For permanent shared daily numbering:
1. Create a Google Sheet named `Getwell Invoice Counter`.
2. Open Extensions → Apps Script from that sheet and paste `Code.gs`.
3. Run `setupInvoiceCounter()` once to create `Counters` and `Invoice Log` tabs.
4. Deploy as a web app, execute as you, and allow access for the intended users.
5. Paste the `/exec` URL into `invoice.js` and commit the change.

The counter uses the spreadsheet in Asia/Kuala_Lumpur time, locks concurrent requests, and records each reservation in the sheet.

## Notes
- `invoice.html` contains embedded reference crops of the supplied logo and signature. Replace them with approved high-resolution assets when available.
- The generator uses external CDN libraries for PDF export and needs an internet connection.
- The invoice number is reserved when Generate PDF is clicked. Reserved numbers are not reused if the download is cancelled or fails.
