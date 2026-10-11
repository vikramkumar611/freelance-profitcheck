import test from "node:test";
import assert from "node:assert/strict";
import { calculateProfit, calculateQuote, validateInputs } from "../calculator.js";

const example = {
  projectPrice: "50000",
  platformFee: "10",
  paymentFee: "2",
  projectExpenses: "3500",
  estimatedHours: "40",
  taxEstimate: "0",
  targetTakehome: "45000"
};

test("calculates the documented take-home example", () => {
  const result = calculateProfit(example);
  assert.equal(result.platformFeeAmount, 5000);
  assert.equal(result.paymentFeeAmount, 1000);
  assert.equal(result.projectExpenses, 3500);
  assert.equal(result.taxAmount, 0);
  assert.equal(result.totalDeductions, 9500);
  assert.equal(result.takeHome, 40500);
  assert.equal(result.effectiveRate, 1012.5);
  assert.equal(result.takeHomePercent, 81);
});

test("calculates estimated tax on positive profit after fees and expenses", () => {
  const result = calculateProfit({ ...example, projectPrice: "10000", projectExpenses: "1000", taxEstimate: "10" });
  assert.equal(result.taxAmount, 780);
  assert.equal(result.takeHome, 7020);
});

test("floors taxable profit at zero and handles zero working hours", () => {
  const result = calculateProfit({ ...example, projectPrice: "100", projectExpenses: "200", estimatedHours: "0", taxEstimate: "25" });
  assert.equal(result.takeHome, 0);
  assert.equal(result.taxAmount, 0);
  assert.equal(result.profitBeforeTax, -112);
  assert.equal(result.shortfall, 112);
  assert.equal(result.effectiveRate, null);
  assert.equal(result.takeHomePercent, 0);
  assert.equal(result.totalDeductions, 212);
});

test("reports a loss-making project without tax or negative take-home", () => {
  const result = calculateProfit({ ...example, projectPrice: "1000", projectExpenses: "950", platformFee: "10", paymentFee: "5", taxEstimate: "30" });
  assert.equal(result.profitBeforeTax, -100);
  assert.equal(result.shortfall, 100);
  assert.equal(result.taxAmount, 0);
  assert.equal(result.takeHome, 0);
  assert.equal(result.effectiveRate, 0);
  assert.equal(result.takeHomePercent, 0);
});

test("treats blank numeric inputs as zero", () => {
  const result = calculateProfit({ ...example, projectPrice: "", platformFee: "", paymentFee: "", projectExpenses: "", estimatedHours: "", taxEstimate: "" });
  assert.equal(result.takeHome, 0);
  assert.equal(result.effectiveRate, null);
  assert.equal(validateInputs({ ...example, projectPrice: "", estimatedHours: "" }), "");
});

test("validates negative, oversized and invalid percentages", () => {
  assert.match(validateInputs({ ...example, projectPrice: "-1" }), /cannot be negative/);
  assert.match(validateInputs({ ...example, projectExpenses: "1000000000001" }), /cannot exceed/);
  assert.match(validateInputs({ ...example, taxEstimate: "100" }), /less than 100%/);
  assert.match(validateInputs({ ...example, platformFee: "70", paymentFee: "30" }), /together must be less than 100%/);
  assert.equal(validateInputs({ ...example, platformFee: "0", paymentFee: "0", taxEstimate: "0" }), "");
});

test("calculates target quote using the documented formula and rounds upward", () => {
  const result = calculateQuote(example);
  assert.equal(result.quote, 55114);
  assert.equal(result.denominator, 0.88);
});

test("calculates the target quote with nonzero tax before adding expenses", () => {
  const result = calculateQuote({ ...example, targetTakehome: "45000", projectExpenses: "3500", platformFee: "10", paymentFee: "2", taxEstimate: "10" });
  assert.equal(result.quote, 60796);
});

test("handles zero target and zero expenses without changing full precision", () => {
  assert.equal(calculateQuote({ ...example, targetTakehome: "0", projectExpenses: "0", platformFee: "0", paymentFee: "0", taxEstimate: "0" }).quote, 0);
  assert.equal(calculateQuote({ ...example, targetTakehome: "45000", projectExpenses: "0", platformFee: "0", paymentFee: "0", taxEstimate: "0" }).quote, 45000);
  assert.equal(calculateQuote({ ...example, targetTakehome: "1", projectExpenses: "0", platformFee: "0", paymentFee: "0", taxEstimate: "0" }).quote, 1);
  assert.equal(calculateQuote({ ...example, targetTakehome: "0.01", projectExpenses: "0", platformFee: "0", paymentFee: "0", taxEstimate: "0" }).quote, 1);
});

test("validates fee and tax denominators and protects quote calculation from invalid rates", () => {
  assert.match(validateInputs({ ...example, platformFee: "99", paymentFee: "1" }), /fees together must be less than 100%/);
  assert.match(validateInputs({ ...example, taxEstimate: "100" }), /less than 100%/);
  assert.match(calculateQuote({ ...example, platformFee: "100", paymentFee: "0" }).error, /must each remain below 100%/);
  assert.match(calculateQuote({ ...example, taxEstimate: "100" }).error, /must each remain below 100%/);
});

test("returns an explicit error when the quote exceeds the supported range", () => {
  const result = calculateQuote({ ...example, targetTakehome: "1000000000000", platformFee: "99", paymentFee: "0" });
  assert.match(result.error, /exceeds the supported limit/);
  assert.match(calculateQuote({ ...example, targetTakehome: "1000000000000", taxEstimate: "50" }).error, /exceeds the supported limit/);
});
