/* Getwell Invoice Generator
 * Configure APPS_SCRIPT_URL after deploying Code.gs as a web app.
 * Invoice sequence allocation is performed by the shared Apps Script endpoint.
 */
(() => {
  "use strict";

  const APPS_SCRIPT_URL = "PASTE_YOUR_DEPLOYED_APPS_SCRIPT_WEB_APP_URL_HERE";
  const $ = (id) => document.getElementById(id);
  const form = $("invoiceForm");
  const itemsEditor = $("itemsEditor");
  const todayISO = localDateISO(new Date());
  let invoiceNumber = "";
  let invoiceCreatedAt = null;
  let itemCounter = 0;

  function localDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function parseISO(value) {
    if (!value) return null;
    const [y,m,d] = value.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  function formatDate(date) {
    if (!date) return "—";
    return new Intl.DateTimeFormat("en-GB", {day:"2-digit", month:"2-digit", year:"numeric"}).format(date);
  }
  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
  function money(value) {
    return Number(value || 0).toLocaleString("en-MY", {minimumFractionDigits:2, maximumFractionDigits:2});
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function setMessage(message, kind = "") {
    $("formMessage").textContent = message;
    $("formMessage").style.color = kind === "error" ? "#b3261e" : kind === "success" ? "#237844" : "";
  }
  function configured() {
    return APPS_SCRIPT_URL.startsWith("https://script.google.com/macros/s/") && !APPS_SCRIPT_URL.includes("PASTE_YOUR");
  }

  function addItemRow(description = "", price = "", qty = "1") {
    itemCounter += 1;
    const id = itemCounter;
    const card = document.createElement("div");
    card.className = "item-card";
    card.dataset.itemId = id;
    card.innerHTML = `
      <div class="item-card-top"><span>Item / service ${id}</span><button type="button" class="remove-item" aria-label="Remove item ${id}">Remove</button></div>
      <div class="item-grid">
        <label class="wide">Item / service description <span>*</span><input class="item-description" required maxlength="180" placeholder="e.g. INFLUENZA TEST KIT" value="${escapeHTML(description)}"></label>
        <label>Unit price (RM) <span>*</span><input class="item-price" required type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" value="${escapeHTML(price)}"></label>
        <label>Quantity <span>*</span><input class="item-qty" required type="number" min="0.01" step="0.01" inputmode="decimal" value="${escapeHTML(qty)}"></label>
      </div>
      <div class="line-amount"><span>Line amount</span><span class="line-amount-value">RM 0.00</span></div>`;
    card.querySelector(".remove-item").addEventListener("click", () => {
      if (itemsEditor.children.length <= 1) { setMessage("At least one item or service is required.", "error"); return; }
      card.remove(); renumberEditorItems(); renderInvoice();
    });
    card.addEventListener("input", renderInvoice);
    itemsEditor.appendChild(card);
    renderInvoice();
  }

  function renumberEditorItems() {
    [...itemsEditor.children].forEach((card, index) => {
      card.querySelector(".item-card-top span").textContent = `Item / service ${index + 1}`;
      card.querySelector(".remove-item").setAttribute("aria-label", `Remove item ${index + 1}`);
    });
  }

  function getItems() {
    return [...itemsEditor.querySelectorAll(".item-card")].map(card => ({
      description: card.querySelector(".item-description").value.trim(),
      price: Number(card.querySelector(".item-price").value || 0),
      qty: Number(card.querySelector(".item-qty").value || 0)
    }));
  }

  function renderInvoice() {
    const label = $("customerLabel").value;
    $("descriptionNameLabel").firstChild.textContent = label + " ";
    $("outRecipientName").textContent = $("recipientName").value.trim() || "Recipient name";
    $("outRecipientIC").textContent = $("recipientIC").value.trim() ? `(${ $("recipientIC").value.trim() })` : "";
    $("outRecipientAddress").textContent = $("recipientAddress").value.trim() || "Recipient address";
    $("outRecipientPhone").innerHTML = $("recipientPhone").value.trim() ? `<strong class="blue-text">M:</strong> ${escapeHTML($("recipientPhone").value.trim())}` : "";
    $("outInvoiceNo").textContent = invoiceNumber || "Assigned when PDF is generated";
    const created = invoiceCreatedAt || new Date();
    $("outInvoiceDate").textContent = formatDate(created);
    const status = $("paymentStatus").value;
    $("outStatus").textContent = status;
    $("outStatus").className = status === "PAID" ? "status-paid" : "status-pending";
    $("outDueDate").textContent = status === "PAID" ? "-" : formatDate(addDays(created, 7));

    const items = getItems();
    const customerLine = `${label}: ${$("descriptionName").value.trim() || "—"}`;
    const purchaseDate = $("purchaseDate").value ? formatDate(parseISO($("purchaseDate").value)) : "—";
    let total = 0;
    const rows = items.map((item, index) => {
      const amount = item.price * item.qty;
      total += amount;
      const details = index === 0
        ? `<div class="description-main">${escapeHTML(customerLine)}<br>Date of Purchase: ${escapeHTML(purchaseDate)}<br>Items:</div><div class="item-detail">${escapeHTML(item.description || "Item / service")}</div>`
        : `<div class="item-detail">${escapeHTML(item.description || "Item / service")}</div>`;
      return `<tr><td>${index + 1}</td><td>${details}</td><td>${money(item.price)}</td><td>${Number.isInteger(item.qty) ? item.qty : item.qty.toLocaleString("en-MY")}</td><td>${money(amount)}</td></tr>`;
    }).join("");
    $("outItems").innerHTML = rows || '<tr><td colspan="5">Add an item or service to begin.</td></tr>';
    $("outSubtotal").textContent = `RM ${money(total)}`;
    $("outGrandTotal").textContent = `RM ${money(total)}`;
  }

  function validateForm() {
    if (!form.reportValidity()) return false;
    const items = getItems();
    if (!items.length || items.some(item => !item.description || !Number.isFinite(item.price) || item.price < 0 || !Number.isFinite(item.qty) || item.qty <= 0)) {
      setMessage("Please complete each item description, unit price and quantity.", "error");
      return false;
    }
    return true;
  }

  async function requestInvoiceNumber() {
    if (!configured()) throw new Error("Shared numbering is not configured. Add the deployed Apps Script URL in invoice.js first.");
    // JSONP avoids cross-origin fetch restrictions on Apps Script ContentService.
    // The callback is generated locally and the server validates callback syntax.
    const callbackName = `getwellInvoiceCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set("action", "reserveNumber");
    url.searchParams.set("callback", callbackName);
    return await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timeout = window.setTimeout(() => finish(new Error("Timed out contacting the shared invoice counter. Please retry.")), 20000);
      function cleanup() {
        window.clearTimeout(timeout);
        delete window[callbackName];
        script.remove();
      }
      function finish(error, result) {
        cleanup();
        if (error) return reject(error);
        if (!result || result.ok !== true || !result.invoiceNumber) return reject(new Error(result?.error || "Could not reserve an invoice number."));
        resolve({ invoiceNumber: result.invoiceNumber, dateKey: result.dateKey, createdAt: result.createdAt });
      }
      window[callbackName] = (result) => finish(null, result);
      script.onerror = () => finish(new Error("Could not reach the shared invoice counter. Check the Apps Script deployment URL and access settings."));
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }

  function dateFromKey(dateKey) {
    // Server returns DDMMYYYY in the Asia/Kuala_Lumpur time zone.
    const day = Number(dateKey.slice(0, 2));
    const month = Number(dateKey.slice(2, 4));
    const year = Number(dateKey.slice(4, 8));
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  async function ensureInvoiceNumber() {
    if (invoiceNumber) return invoiceNumber;
    $("generateButton").disabled = true;
    $("previewButton").disabled = true;
    setMessage("Reserving the next shared invoice number…");
    try {
      const reservation = await requestInvoiceNumber();
      invoiceNumber = reservation.invoiceNumber;
      invoiceCreatedAt = dateFromKey(reservation.dateKey);
      $("connectionNotice").className = "notice notice-ok";
      $("connectionNotice").textContent = `Shared numbering connected. Reserved invoice ${invoiceNumber}. This number is now allocated and will not be reused.`;
      renderInvoice();
      return invoiceNumber;
    } finally {
      $("generateButton").disabled = false;
      $("previewButton").disabled = false;
    }
  }

  async function generatePDF() {
    if (!validateForm()) return;
    const button = $("generateButton");
    button.disabled = true;
    try {
      await ensureInvoiceNumber();
      renderInvoice();
      if (!window.html2canvas || !window.jspdf?.jsPDF) throw new Error("PDF libraries did not load. Check your internet connection and refresh the page.");
      setMessage("Preparing your PDF…");
      const paper = $("invoicePaper");
      const canvas = await window.html2canvas(paper, {scale:2, useCORS:true, backgroundColor:"#ffffff", logging:false});
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({orientation:"portrait", unit:"mm", format:"a4", compress:true});
      const pageWidth = 210, pageHeight = 297;
      const margin = 0;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = canvas.height * imgWidth / canvas.width;
      const image = canvas.toDataURL("image/jpeg", 0.96);
      if (imgHeight <= pageHeight) {
        pdf.addImage(image, "JPEG", margin, 0, imgWidth, imgHeight, undefined, "FAST");
      } else {
        // Preserve the full invoice on one A4 page by scaling its content to fit.
        const fitWidth = pageWidth;
        const fitHeight = pageHeight;
        pdf.addImage(image, "JPEG", 0, 0, fitWidth, fitHeight, undefined, "FAST");
      }
      const filename = `Invoice Klinik Perubatan Getwell ${invoiceNumber}.pdf`;
      pdf.save(filename);
      setMessage(`PDF generated: ${filename}`, "success");
    } catch (error) {
      setMessage(error.message || "Unable to generate the PDF.", "error");
    } finally {
      button.disabled = false;
    }
  }

  $("addItem").addEventListener("click", () => addItemRow());
  $("previewButton").addEventListener("click", () => {
    renderInvoice();
    $("preview-title").scrollIntoView({behavior:"smooth", block:"start"});
    setMessage("Preview updated. The permanent invoice number is reserved when you generate the PDF.");
  });
  $("generateButton").addEventListener("click", generatePDF);
  $("customerLabel").addEventListener("change", renderInvoice);
  $("paymentStatus").addEventListener("change", renderInvoice);
  form.addEventListener("input", renderInvoice);
  form.addEventListener("submit", event => event.preventDefault());

  $("purchaseDate").value = todayISO;
  addItemRow();
  renderInvoice();

  if (configured()) {
    $("connectionNotice").className = "notice notice-ok";
    $("connectionNotice").textContent = "Apps Script URL configured. The next invoice number will be reserved from the shared counter when you generate the PDF.";
  }
})();
