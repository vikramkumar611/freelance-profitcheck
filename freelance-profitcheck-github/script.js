import { calculateProfit, calculateQuote, validateInputs } from "./calculator.js";
import { calculateInvoice, validateInvoice } from "./invoice.js";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});
const ids = ["projectPrice", "platformFee", "paymentFee", "projectExpenses", "estimatedHours", "taxEstimate", "targetTakehome"];
const fields = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const defaults = Object.fromEntries(ids.map((id) => [id, fields[id].value]));
const output = (id) => document.getElementById(id);
const savedKey = "freelance-profitcheck-estimate-v1";

function formatCurrency(value) {
  return money.format(value);
}

function readValues() {
  return Object.fromEntries(ids.map((id) => [id, fields[id].value]));
}

function setInvalidState(message, errorId) {
  output(errorId).textContent = message;
  const values = readValues();
  ids.forEach((id) => {
    const value = values[id];
    const isBlank = value === "";
    const numericValue = Number(value);
    const isPercent = ["platformFee", "paymentFee", "taxEstimate"].includes(id);
    let invalid = !isBlank && (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 1_000_000_000_000);
    if (!isBlank && isPercent && numericValue >= 100) invalid = true;
    if ((id === "platformFee" || id === "paymentFee") &&
      Number(values.platformFee || 0) + Number(values.paymentFee || 0) >= 100) invalid = true;
    fields[id].setAttribute("aria-invalid", String(invalid));
  });
}

function render() {
  const values = readValues();
  const error = validateInputs(values);
  setInvalidState(error, "profitError");
  setInvalidState(error, "quoteError");

  if (error) {
    output("resultLabel").textContent = "Estimated take-home";
    output("keepAmount").textContent = "—";
    output("shortfallMessage").hidden = true;
    output("progressWrap").hidden = false;
    output("effectiveRate").textContent = "—";
    output("totalDeductions").textContent = "—";
    output("suggestedQuote").textContent = "—";
    output("quoteNote").textContent = "Correct the highlighted input values to see an estimate.";
    ["platformFeeAmount", "paymentFeeAmount", "expensesAmount", "taxAmount", "quoteFees", "quoteExpenses", "quoteTax"].forEach((id) => output(id).textContent = "—");
    output("percentKeep").textContent = "Estimate unavailable until inputs are valid.";
    output("percentLoss").textContent = "";
    output("progressFill").style.width = "0%";
    output("progressBar").setAttribute("aria-valuenow", "0");
    return;
  }

  const result = calculateProfit(values);
  const quote = calculateQuote(values);
  const isLossMaking = result.shortfall > 0;
  output("resultLabel").textContent = isLossMaking ? "Estimated shortfall" : "Estimated take-home";
  output("keepAmount").textContent = formatCurrency(result.takeHome);
  output("shortfallMessage").hidden = !isLossMaking;
  output("shortfallMessage").textContent = isLossMaking
    ? `Project fees and expenses exceed the price by ${formatCurrency(result.shortfall)}. No tax is estimated while pre-tax profit is zero or below.`
    : "";
  output("effectiveRate").textContent = result.effectiveRate === null ? "Enter hours" : `${formatCurrency(result.effectiveRate)}/hr`;
  output("totalDeductions").textContent = formatCurrency(result.totalDeductions);
  output("platformFeeAmount").textContent = formatCurrency(result.platformFeeAmount);
  output("paymentFeeAmount").textContent = formatCurrency(result.paymentFeeAmount);
  output("expensesAmount").textContent = formatCurrency(result.projectExpenses);
  output("taxAmount").textContent = formatCurrency(result.taxAmount);
  output("progressWrap").hidden = isLossMaking;
  output("progressFill").style.width = `${Math.min(Math.max(result.takeHomePercent, 0), 100)}%`;
  output("progressBar").setAttribute("aria-valuenow", String(Math.round(result.takeHomePercent)));
  output("percentKeep").textContent = isLossMaking
    ? "Project price does not cover all estimated fees and expenses."
    : `${result.takeHomePercent.toFixed(1)}% of your project price is estimated take-home`;
  output("percentLoss").textContent = isLossMaking
    ? ""
    : `${Math.max(100 - result.takeHomePercent, 0).toFixed(1)}% goes to costs and estimated tax`;

  if (quote.error) {
    output("suggestedQuote").textContent = "—";
    output("quoteNote").textContent = quote.error;
  } else {
    output("suggestedQuote").textContent = formatCurrency(quote.quote);
    output("quoteNote").textContent = "Assumes tax is applied to positive profit after fees and expenses; rounded up to the next rupee.";
  }
  output("quoteFees").textContent = `${(quote.feeRate * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
  output("quoteExpenses").textContent = formatCurrency(result.projectExpenses);
  output("quoteTax").textContent = `${(quote.taxRate * 100).toFixed(2).replace(/\.?0+$/, "")}% (estimate)`;
}

function announce(message) {
  output("actionStatus").textContent = message;
}

function estimateSummary() {
  const values = readValues();
  const result = calculateProfit(values);
  const quote = calculateQuote(values);
  return [
    "Freelance ProfitCheck India — estimate",
    `Project price: ${formatCurrency(result.projectPrice)}`,
    `Platform fee rate: ${Number(values.platformFee || 0)}%`,
    `Payment fee rate: ${Number(values.paymentFee || 0)}%`,
    `Platform fee: ${formatCurrency(result.platformFeeAmount)}`,
    `Payment fee: ${formatCurrency(result.paymentFeeAmount)}`,
    `Project expenses: ${formatCurrency(result.projectExpenses)}`,
    `Estimated tax: ${formatCurrency(result.taxAmount)}`,
    `Estimated tax rate: ${Number(values.taxEstimate || 0)}%`,
    `Estimated hours: ${Number(values.estimatedHours || 0)}`,
    `Estimated take-home: ${formatCurrency(result.takeHome)}`,
    `Estimated shortfall: ${formatCurrency(result.shortfall)}`,
    `Effective hourly earnings: ${result.effectiveRate === null ? "Not available (zero hours)" : `${formatCurrency(result.effectiveRate)}/hr`}`,
    `Suggested quote: ${quote.error ? quote.error : formatCurrency(quote.quote)}`,
    "Estimates only; not tax, legal, accounting, or financial advice."
  ].join("\n");
}

ids.forEach((id) => fields[id].addEventListener("input", render));

output("resetButton").addEventListener("click", () => {
  Object.entries(defaults).forEach(([id, value]) => fields[id].value = value);
  render();
  announce("Calculator reset to the example values.");
});

output("saveButton").addEventListener("click", () => {
  const error = validateInputs(readValues());
  if (error) {
    announce("Correct the input errors before saving.");
    return;
  }
  try {
    localStorage.setItem(savedKey, JSON.stringify(readValues()));
    announce("Estimate saved in this browser.");
  } catch (error) {
    announce("Could not save the estimate. Check your browser storage settings.");
    console.error("Saving estimate failed.", error);
  }
});

output("restoreButton").addEventListener("click", () => {
  try {
    const saved = localStorage.getItem(savedKey);
    if (!saved) {
      announce("No saved estimate was found in this browser.");
      return;
    }
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      announce("The saved estimate is invalid. Reset the calculator and save a new estimate.");
      return;
    }
    const error = validateInputs(parsed);
    if (error || ids.some((id) => !(id in parsed))) {
      announce("The saved estimate is invalid. Reset the calculator and save a new estimate.");
      return;
    }
    ids.forEach((id) => fields[id].value = parsed[id]);
    render();
    announce("Saved estimate restored.");
  } catch (error) {
    announce("Could not restore the estimate. It may be damaged or browser storage may be unavailable.");
    console.error("Restoring estimate failed.", error);
  }
});

output("copyButton").addEventListener("click", async () => {
  if (validateInputs(readValues())) {
    announce("Correct the input errors before copying an estimate.");
    return;
  }
  try {
    await navigator.clipboard.writeText(estimateSummary());
    announce("Estimate summary copied to the clipboard.");
  } catch (error) {
    announce("Clipboard access is unavailable. Try the print option or allow clipboard access in your browser.");
    console.error("Copying estimate failed.", error);
  }
});

const invoiceDialog = output("invoiceDialog");
const invoiceForm = output("invoiceForm");
const invoicePreviewWrap = output("invoicePreviewWrap");
const invoicePreview = output("invoicePreview");
const invoicePrintSurface = output("invoicePrintSurface");
const invoiceFields = {
  seller: output("invoiceSeller"),
  sellerEmail: output("invoiceSellerEmail"),
  sellerPhone: output("invoiceSellerPhone"),
  sellerWebsite: output("invoiceSellerWebsite"),
  sellerAddress: output("invoiceSellerAddress"),
  sellerTaxId: output("invoiceSellerTaxId"),
  customer: output("invoiceCustomer"),
  customerEmail: output("invoiceCustomerEmail"),
  customerAddress: output("invoiceCustomerAddress"),
  customerTaxId: output("invoiceCustomerTaxId"),
  invoiceNumber: output("invoiceNumber"),
  invoiceDate: output("invoiceDate"),
  dueDate: output("invoiceDueDate"),
  taxRate: output("invoiceTaxRate"),
  amountPaid: output("invoicePaid"),
  notes: output("invoiceNotes"),
  payee: output("invoicePayee"),
  bankName: output("invoiceBankName"),
  accountNumber: output("invoiceAccountNumber"),
  ifsc: output("invoiceIfsc"),
  upi: output("invoiceUpi"),
  paymentTerms: output("invoicePaymentTerms")
};
const invoiceLineItems = output("invoiceLineItems");
const invoiceLogo = output("invoiceLogo");
let invoiceLogoDataUrl = "";

function addInvoiceLine(item = {}) {
  if (invoiceLineItems.children.length >= 20) {
    output("invoiceError").textContent = "An invoice can contain at most 20 items.";
    return;
  }
  const row = document.createElement("tr");
  for (const [key, placeholder, type, value] of [
    ["description", "Service or item description", "text", item.description || ""],
    ["serviceCode", "Optional code", "text", item.serviceCode || ""],
    ["quantity", "Qty", "number", item.quantity || "1"],
    ["rate", "Rate (₹)", "number", item.rate ?? ""]
  ]) {
    const cell = document.createElement("td");
    const field = document.createElement("input");
    field.type = type;
    field.name = key;
    field.placeholder = placeholder;
    field.value = value;
    field.required = key !== "serviceCode";
    field.maxLength = key === "description" ? 200 : 30;
    if (key === "quantity" || key === "rate") {
      field.min = key === "quantity" ? "0.01" : "0";
      field.max = key === "quantity" ? "1000000" : "1000000000000";
      field.step = "any";
      field.inputMode = "decimal";
    }
    cell.append(field);
    row.append(cell);
  }
  const actionCell = document.createElement("td");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove-invoice-line";
  remove.textContent = "Remove";
  remove.setAttribute("aria-label", "Remove invoice item");
  remove.disabled = invoiceLineItems.children.length === 0;
  remove.addEventListener("click", () => {
    row.remove();
    updateInvoiceLineControls();
  });
  actionCell.append(remove);
  row.append(actionCell);
  invoiceLineItems.append(row);
  updateInvoiceLineControls();
}

function updateInvoiceLineControls() {
  const rows = [...invoiceLineItems.children];
  rows.forEach((row) => {
    row.querySelector(".remove-invoice-line").disabled = rows.length === 1;
  });
  output("addInvoiceLine").disabled = rows.length >= 20;
}

function localDateValue() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function newInvoiceNumber() {
  const date = localDateValue().replaceAll("-", "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "0");
  return `INV-${date}-${suffix}`;
}

function openInvoiceCreator() {
  const error = validateInputs(readValues());
  if (error) {
    announce("Correct calculator input errors before creating an invoice.");
    output("projectPrice").focus();
    return;
  }

  invoiceFields.invoiceNumber.value = newInvoiceNumber();
  invoiceFields.invoiceDate.value = localDateValue();
  invoiceFields.dueDate.value = "";
  invoiceLineItems.replaceChildren();
  addInvoiceLine({ description: "Freelance project services", quantity: "1", rate: fields.projectPrice.value });
  invoiceFields.taxRate.value = "0";
  invoiceFields.amountPaid.value = "0";
  invoiceFields.notes.value = "";
  invoiceFields.payee.value = "";
  invoiceFields.bankName.value = "";
  invoiceFields.accountNumber.value = "";
  invoiceFields.ifsc.value = "";
  invoiceFields.upi.value = "";
  invoiceFields.paymentTerms.value = "";
  invoiceLogo.value = "";
  invoiceLogoDataUrl = "";
  output("invoiceError").textContent = "";
  invoiceForm.hidden = false;
  invoicePreviewWrap.hidden = true;
  if (!invoiceDialog.open) invoiceDialog.showModal();
  invoiceFields.seller.focus();
}

function readInvoiceValues() {
  return {
    ...Object.fromEntries(Object.entries(invoiceFields).map(([key, field]) => [key, field.value])),
    items: [...invoiceLineItems.querySelectorAll("tr")].map((row) =>
      Object.fromEntries([...row.querySelectorAll("input")].map((field) => [field.name, field.value]))
    )
  };
}

function setPreviewText(id, value) {
  output(id).textContent = value || "";
}

async function renderInvoicePreview() {
  const values = readInvoiceValues();
  const validation = validateInvoice(values);
  output("invoiceError").textContent = validation;
  let customInvalidField = null;
  if (validation.startsWith("Amount already paid")) customInvalidField = invoiceFields.amountPaid;
  else if (validation.startsWith("Due date")) customInvalidField = invoiceFields.dueDate;
  else if (validation.startsWith("Invoice total") || validation.startsWith("Invoice subtotal") || validation.includes("amount is too large")) customInvalidField = invoiceLineItems.querySelector('[name="rate"]');
  else if (validation.includes("quantity")) customInvalidField = invoiceLineItems.querySelector('[name="quantity"]');
  else if (validation.includes("rate must")) customInvalidField = invoiceLineItems.querySelector('[name="rate"]');
  else if (validation.startsWith("Additional tax")) customInvalidField = invoiceFields.taxRate;
  else {
    customInvalidField = [
      ["seller", "Enter your business"],
      ["sellerAddress", "Enter your business address"],
      ["customer", "Enter the customer"],
      ["customerAddress", "Enter the billing address"],
      ["invoiceNumber", "Enter an invoice number"],
      ["invoiceDate", "Choose an invoice date"]
    ].find(([, prefix]) => validation.startsWith(prefix))?.[0];
    if (customInvalidField) customInvalidField = invoiceFields[customInvalidField];
  }
  [...Object.values(invoiceFields), ...invoiceLineItems.querySelectorAll("input")].forEach((field) => {
    field.setAttribute("aria-invalid", String(!field.checkValidity() || field === customInvalidField));
  });
  if (validation || !invoiceForm.checkValidity()) {
    const invalidField = [...Object.values(invoiceFields), ...invoiceLineItems.querySelectorAll("input")].find((field) => !field.checkValidity());
    invalidField?.focus();
    return;
  }

  const total = calculateInvoice(values);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const style = invoiceForm.querySelector('input[name="invoiceStyle"]:checked')?.value;
  invoicePreview.className = `invoice-paper invoice-${style || "classic"}`;
  setPreviewText("previewSeller", values.seller.trim());
  setPreviewText("previewSellerAddress", values.sellerAddress.trim());
  setPreviewText("previewSellerContact", [
    values.sellerPhone.trim(),
    emailPattern.test(values.sellerEmail) ? values.sellerEmail.trim() : "",
    values.sellerWebsite.trim()
  ].filter(Boolean).join("  |  "));
  setPreviewText("previewSellerTaxId", values.sellerTaxId.trim() ? `GSTIN / tax ID: ${values.sellerTaxId.trim()}` : "");
  setPreviewText("previewCustomer", values.customer.trim());
  setPreviewText("previewCustomerAddress", values.customerAddress.trim());
  setPreviewText("previewCustomerContact", emailPattern.test(values.customerEmail) ? values.customerEmail.trim() : "");
  setPreviewText("previewCustomerTaxId", values.customerTaxId.trim() ? `GSTIN / tax ID: ${values.customerTaxId.trim()}` : "");
  setPreviewText("previewNumber", values.invoiceNumber.trim());
  setPreviewText("previewStatus", total.status);
  setPreviewText("previewDate", new Date(`${values.invoiceDate}T00:00:00`).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }));
  const dueDateRow = output("previewDueDateRow");
  dueDateRow.hidden = !values.dueDate;
  if (values.dueDate) setPreviewText("previewDueDate", new Date(`${values.dueDate}T00:00:00`).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }));
  const previewLineItems = output("previewLineItems");
  previewLineItems.replaceChildren(...total.items.map((item) => {
    const row = document.createElement("tr");
    for (const [text, className] of [
      [item.description, ""],
      [item.serviceCode, ""],
      [item.quantity.toLocaleString("en-IN"), "invoice-number-cell"],
      [money.format(item.rate), "invoice-number-cell"],
      [money.format(item.amount), "invoice-number-cell"]
    ]) {
      const cell = document.createElement("td");
      cell.textContent = text;
      if (className) cell.className = className;
      row.append(cell);
    }
    return row;
  }));
  setPreviewText("previewSubtotalTotal", money.format(total.subtotal));
  setPreviewText("previewTaxRate", String(total.taxRate));
  setPreviewText("previewTax", money.format(total.taxAmount));
  setPreviewText("previewTotal", money.format(total.total));
  setPreviewText("previewPaid", money.format(total.amountPaid));
  setPreviewText("previewBalance", money.format(total.balanceDue));
  const paymentInformation = [
    values.payee.trim() && `Account holder: ${values.payee.trim()}`,
    values.bankName.trim() && `Bank: ${values.bankName.trim()}`,
    values.accountNumber.trim() && `Account number: ${values.accountNumber.trim()}`,
    values.ifsc.trim() && `IFSC / routing code: ${values.ifsc.trim()}`,
    values.upi.trim() && `UPI ID: ${values.upi.trim()}`,
    values.paymentTerms.trim()
  ].filter(Boolean).join("\n");
  setPreviewText("previewPaymentTerms", paymentInformation);
  setPreviewText("previewNotes", values.notes.trim());
  const logo = output("previewLogo");
  logo.hidden = !invoiceLogoDataUrl;
  if (invoiceLogoDataUrl) logo.src = invoiceLogoDataUrl;
  else logo.removeAttribute("src");
  output("previewTaxRow").hidden = total.taxRate === 0;
  output("previewPaymentSection").hidden = !paymentInformation;
  output("previewNotesSection").hidden = !values.notes.trim();
  invoiceForm.hidden = true;
  invoicePreviewWrap.hidden = false;
  output("editInvoice").focus();
}

output("printButton").addEventListener("click", () => {
  const values = readValues();
  const error = validateInputs(values);
  render();
  if (error) {
    announce("Correct the input errors before printing an estimate.");
    fields[ids.find((id) => fields[id].getAttribute("aria-invalid") === "true") || ids[0]].focus();
    return;
  }

  const result = calculateProfit(values);
  const quote = calculateQuote(values);
  const printDate = output("printEstimateDate");
  printDate.textContent = `Prepared ${new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}`;
  const printValues = {
    printProjectPrice: formatCurrency(result.projectPrice),
    printPlatformRate: `${Number(values.platformFee || 0)}%`,
    printPaymentRate: `${Number(values.paymentFee || 0)}%`,
    printHours: `${Number(values.estimatedHours || 0)} hours`,
    printTaxRate: `${Number(values.taxEstimate || 0)}%`,
    printPlatformAmount: formatCurrency(result.platformFeeAmount),
    printPaymentAmount: formatCurrency(result.paymentFeeAmount),
    printExpenses: formatCurrency(result.projectExpenses),
    printTaxAmount: formatCurrency(result.taxAmount),
    printTakehome: formatCurrency(result.takeHome),
    printHourly: result.effectiveRate === null ? "Not available (zero hours)" : `${formatCurrency(result.effectiveRate)} / hour`,
    printShortfall: formatCurrency(result.shortfall),
    printQuote: quote.error ? quote.error : formatCurrency(quote.quote)
  };
  Object.entries(printValues).forEach(([id, value]) => setPreviewText(id, value));
  output("estimatePrintSurface").hidden = false;
  document.body.classList.add("estimate-printing");
  const finishPrint = () => {
    document.body.classList.remove("estimate-printing");
    output("estimatePrintSurface").hidden = true;
    window.removeEventListener("afterprint", finishPrint);
  };
  window.addEventListener("afterprint", finishPrint, { once: true });
  window.print();
  window.setTimeout(() => {
    if (document.body.classList.contains("estimate-printing")) finishPrint();
  }, 60_000);
});
output("createInvoiceButton").addEventListener("click", openInvoiceCreator);
output("closeInvoiceDialog").addEventListener("click", () => invoiceDialog.close());
output("cancelInvoice").addEventListener("click", () => invoiceDialog.close());
output("previewInvoice").addEventListener("click", renderInvoicePreview);
output("addInvoiceLine").addEventListener("click", () => addInvoiceLine());
invoiceLogo.addEventListener("change", () => {
  const file = invoiceLogo.files?.[0];
  output("invoiceError").textContent = "";
  invoiceLogoDataUrl = "";
  if (!file) return;
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
    invoiceLogo.value = "";
    output("invoiceError").textContent = "Choose a PNG, JPEG, or WebP logo no larger than 2 MB.";
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    if (typeof reader.result === "string") invoiceLogoDataUrl = reader.result;
    else output("invoiceError").textContent = "The selected logo could not be read.";
  });
  reader.addEventListener("error", () => {
    output("invoiceError").textContent = "The selected logo could not be read.";
  });
  reader.readAsDataURL(file);
});
output("editInvoice").addEventListener("click", () => {
  invoicePreviewWrap.hidden = true;
  invoiceForm.hidden = false;
  invoiceFields.seller.focus();
});

invoiceForm.addEventListener("change", (event) => {
  if (event.target.name === "invoiceStyle" && !invoicePreviewWrap.hidden) {
    const style = event.target.value;
    invoicePreview.className = `invoice-paper invoice-${style}`;
  }
});

output("printInvoice").addEventListener("click", () => {
  invoicePrintSurface.replaceChildren(invoicePreview.cloneNode(true));
  invoicePrintSurface.hidden = false;
  document.body.classList.add("invoice-printing");
  invoiceDialog.close();

  const finishPrint = () => {
    document.body.classList.remove("invoice-printing");
    invoicePrintSurface.hidden = true;
    invoicePrintSurface.replaceChildren();
    window.removeEventListener("afterprint", finishPrint);
  };

  window.addEventListener("afterprint", finishPrint, { once: true });
  window.print();
  window.setTimeout(() => {
    if (document.body.classList.contains("invoice-printing")) finishPrint();
  }, 60_000);
});

output("calculateQuoteBtn").addEventListener("click", () => {
  const error = validateInputs(readValues());
  if (error) {
    output("quoteError").textContent = error;
    fields.projectPrice.focus();
    return;
  }
  output("quoteError").textContent = "";
  announce("Suggested quote updated.");
});

render();
