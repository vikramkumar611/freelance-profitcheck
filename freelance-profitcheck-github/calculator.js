export const MAX_AMOUNT = 1_000_000_000_000;

export function validateInputs(values) {
  const amountFields = ["projectPrice", "projectExpenses", "estimatedHours", "targetTakehome"];
  const percentageFields = ["platformFee", "paymentFee", "taxEstimate"];

  for (const key of [...amountFields, ...percentageFields]) {
    const value = values[key];
    if (value === "" || value === null || value === undefined) continue;
    if (!Number.isFinite(Number(value))) return `${labelFor(key)} must be a valid number.`;
    if (Number(value) < 0) return `${labelFor(key)} cannot be negative.`;
    if (Number(value) > MAX_AMOUNT) return `${labelFor(key)} cannot exceed ${MAX_AMOUNT.toLocaleString("en-IN")}.`;
  }

  for (const key of percentageFields) {
    if (Number(values[key] || 0) >= 100) return `${labelFor(key)} must be less than 100%.`;
  }

  if (Number(values.platformFee || 0) + Number(values.paymentFee || 0) >= 100) {
    return "Platform and payment fees together must be less than 100%.";
  }

  return "";
}

function labelFor(key) {
  return {
    projectPrice: "Project price",
    platformFee: "Platform fee",
    paymentFee: "Payment fee",
    projectExpenses: "Project expenses",
    estimatedHours: "Estimated hours",
    taxEstimate: "Tax estimate",
    targetTakehome: "Target take-home"
  }[key] || "Value";
}

function asNumber(value) {
  return value === "" || value === null || value === undefined ? 0 : Number(value);
}

export function calculateProfit(values) {
  const projectPrice = asNumber(values.projectPrice);
  const platformFee = asNumber(values.platformFee);
  const paymentFee = asNumber(values.paymentFee);
  const projectExpenses = asNumber(values.projectExpenses);
  const estimatedHours = asNumber(values.estimatedHours);
  const taxRate = asNumber(values.taxEstimate) / 100;
  const platformFeeAmount = projectPrice * platformFee / 100;
  const paymentFeeAmount = projectPrice * paymentFee / 100;
  const profitBeforeTax = projectPrice - platformFeeAmount - paymentFeeAmount - projectExpenses;
  const shortfall = Math.max(0, -profitBeforeTax);
  const taxableProfit = Math.max(0, profitBeforeTax);
  const taxAmount = taxableProfit * taxRate;
  const takeHome = taxableProfit - taxAmount;
  const totalDeductions = platformFeeAmount + paymentFeeAmount + projectExpenses + taxAmount;

  return {
    projectPrice,
    platformFeeAmount,
    paymentFeeAmount,
    projectExpenses,
    profitBeforeTax,
    shortfall,
    taxAmount,
    totalDeductions,
    takeHome,
    effectiveRate: estimatedHours > 0 ? takeHome / estimatedHours : null,
    takeHomePercent: projectPrice > 0 ? takeHome / projectPrice * 100 : 0
  };
}

export function calculateQuote(values) {
  const targetTakehome = asNumber(values.targetTakehome);
  const expenses = asNumber(values.projectExpenses);
  const feeRate = (asNumber(values.platformFee) + asNumber(values.paymentFee)) / 100;
  const taxRate = asNumber(values.taxEstimate) / 100;
  const feeDenominator = 1 - feeRate;
  const taxDenominator = 1 - taxRate;
  const denominator = feeDenominator * taxDenominator;
  if (feeDenominator <= 0 || taxDenominator <= 0 || denominator <= 0) {
    return { error: "Fee and tax rates must each remain below 100% to calculate a quote." };
  }
  const rawQuote = (targetTakehome / taxDenominator + expenses) / feeDenominator;

  if (!Number.isFinite(rawQuote) || rawQuote > MAX_AMOUNT) {
    return { error: "This quote exceeds the supported limit. Reduce the target, expenses, or fee percentages." };
  }

  return {
    quote: Math.ceil(rawQuote),
    targetTakehome,
    expenses,
    feeRate,
    taxRate,
    denominator
  };
}
