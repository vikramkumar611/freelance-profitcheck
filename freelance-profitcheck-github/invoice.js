import { MAX_AMOUNT } from "./calculator.js";

function invoiceLines(values) {
  return Array.isArray(values.items) ? values.items : [{
    description: values.description,
    serviceCode: values.serviceCode,
    quantity: values.quantity,
    rate: values.rate
  }];
}

export function validateInvoice(values) {
  const requiredText = [
    ["seller", "Enter your business or freelancer name."],
    ["sellerAddress", "Enter your business address."],
    ["customer", "Enter the customer or business name."],
    ["customerAddress", "Enter the billing address."],
    ["invoiceNumber", "Enter an invoice number."],
    ["invoiceDate", "Choose an invoice date."]
  ];
  for (const [key, message] of requiredText) {
    if (!String(values[key] || "").trim()) return message;
  }

  const items = invoiceLines(values);
  if (!items.length || items.length > 20) return "An invoice must have between 1 and 20 items.";
  let subtotal = 0;
  for (const [index, item] of items.entries()) {
    if (!String(item.description || "").trim()) return `Enter a description for item ${index + 1}.`;
    const quantity = Number(item.quantity);
    const rate = Number(item.rate);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) {
      return `Item ${index + 1} quantity must be greater than zero and no more than 1,000,000.`;
    }
    if (!Number.isFinite(rate) || rate < 0 || rate > MAX_AMOUNT) {
      return `Item ${index + 1} rate must be between ₹0 and ₹${MAX_AMOUNT.toLocaleString("en-IN")}.`;
    }
    const lineTotal = quantity * rate;
    if (!Number.isFinite(lineTotal) || lineTotal > MAX_AMOUNT) {
      return `Item ${index + 1} amount is too large. Reduce the quantity or rate.`;
    }
    subtotal += lineTotal;
    if (!Number.isFinite(subtotal) || subtotal > MAX_AMOUNT) {
      return `Invoice subtotal cannot exceed ₹${MAX_AMOUNT.toLocaleString("en-IN")}.`;
    }
  }
  const taxRate = values.taxRate === "" ? 0 : Number(values.taxRate);
  const amountPaid = values.amountPaid === "" ? 0 : Number(values.amountPaid);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    return "Additional tax rate must be between 0% and 100%.";
  }
  const total = subtotal * (1 + taxRate / 100);
  if (!Number.isFinite(total) || total > MAX_AMOUNT) {
    return `Invoice total cannot exceed ₹${MAX_AMOUNT.toLocaleString("en-IN")}.`;
  }
  if (!Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid > MAX_AMOUNT) {
    return `Amount paid must be between ₹0 and ₹${MAX_AMOUNT.toLocaleString("en-IN")}.`;
  }
  if (amountPaid > total) return "Amount already paid cannot be greater than the invoice total.";
  if (values.dueDate && values.invoiceDate && values.dueDate < values.invoiceDate) {
    return "Due date cannot be earlier than the invoice date.";
  }
  return "";
}

export function calculateInvoice(values) {
  const items = invoiceLines(values).map((item) => ({
    description: String(item.description || "").trim(),
    serviceCode: String(item.serviceCode || "").trim(),
    quantity: Number(item.quantity),
    rate: Number(item.rate),
    amount: Number(item.quantity) * Number(item.rate)
  }));
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxRate = values.taxRate === "" ? 0 : Number(values.taxRate);
  const taxAmount = subtotal * taxRate / 100;
  const total = subtotal + taxAmount;
  const amountPaid = values.amountPaid === "" ? 0 : Number(values.amountPaid);
  return {
    items, subtotal, taxRate, taxAmount, total, amountPaid,
    balanceDue: Math.max(total - amountPaid, 0),
    status: total > 0 && amountPaid >= total ? "PAID" : amountPaid > 0 ? "PARTIALLY PAID" : "PAYMENT DUE"
  };
}
