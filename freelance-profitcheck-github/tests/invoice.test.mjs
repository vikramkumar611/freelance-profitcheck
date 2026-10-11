import test from "node:test";
import assert from "node:assert/strict";
import { calculateInvoice, validateInvoice } from "../invoice.js";

const invoice = {
  seller: "Studio",
  sellerAddress: "Mumbai",
  customer: "Client",
  customerAddress: "Pune",
  invoiceNumber: "INV-20261011-A1B2",
  invoiceDate: "2026-10-11",
  description: "Website design services",
  quantity: "2",
  rate: "25000",
  taxRate: "18",
  amountPaid: "10000"
};

test("calculates invoice subtotal, additional tax, payment, balance and status", () => {
  assert.deepEqual(calculateInvoice(invoice), {
    items: [{
      description: "Website design services",
      serviceCode: "",
      quantity: 2,
      rate: 25000,
      amount: 50000
    }],
    subtotal: 50000,
    taxRate: 18,
    taxAmount: 9000,
    total: 59000,
    amountPaid: 10000,
    balanceDue: 49000,
    status: "PARTIALLY PAID"
  });
});

test("validates required invoice parties, item, date and positive quantity", () => {
  assert.equal(validateInvoice(invoice), "");
  assert.match(validateInvoice({ ...invoice, customer: "  " }), /customer or business name/);
  assert.match(validateInvoice({ ...invoice, quantity: "0" }), /quantity must be greater than zero/);
});

test("rejects tax outside range and paid amounts greater than invoice total", () => {
  assert.match(validateInvoice({ ...invoice, taxRate: "101" }), /tax rate must be between/);
  assert.match(validateInvoice({ ...invoice, amountPaid: "59001" }), /cannot be greater than the invoice total/);
});

test("rejects invoice totals beyond the supported amount", () => {
  assert.match(validateInvoice({ ...invoice, quantity: "9", rate: "100000000000", taxRate: "20" }), /Invoice total cannot exceed/);
});

test("marks a zero-value invoice as due rather than paid", () => {
  const result = calculateInvoice({ ...invoice, rate: "0", taxRate: "0", amountPaid: "0" });
  assert.equal(result.status, "PAYMENT DUE");
});

test("calculates and validates multiple itemized lines", () => {
  const values = {
    ...invoice,
    items: [
      { description: "Design", serviceCode: "9983", quantity: "2", rate: "2500" },
      { description: "Hosting", serviceCode: "", quantity: "3", rate: "500" }
    ],
    taxRate: "10",
    amountPaid: "1000"
  };
  assert.equal(validateInvoice(values), "");
  assert.deepEqual(calculateInvoice(values).items.map(({ amount }) => amount), [5000, 1500]);
  assert.equal(calculateInvoice(values).subtotal, 6500);
  assert.equal(calculateInvoice(values).taxAmount, 650);
  assert.equal(calculateInvoice(values).balanceDue, 6150);
});

test("rejects missing item descriptions, excessive item count and invalid due dates", () => {
  assert.match(validateInvoice({ ...invoice, items: [{ description: " ", quantity: "1", rate: "10" }] }), /description for item 1/);
  assert.match(validateInvoice({ ...invoice, items: Array.from({ length: 21 }, () => ({ description: "Work", quantity: "1", rate: "1" })) }), /between 1 and 20 items/);
  assert.match(validateInvoice({ ...invoice, dueDate: "2026-10-10" }), /Due date cannot be earlier/);
});

test("rejects combined subtotals above the supported amount", () => {
  assert.match(validateInvoice({
    ...invoice,
    items: [
      { description: "A", quantity: "1", rate: "800000000000" },
      { description: "B", quantity: "1", rate: "800000000000" }
    ]
  }), /Invoice subtotal cannot exceed/);
});
