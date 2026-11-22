export interface GradeSplit {
  grade_a_kg?: number | null;
  grade_b_kg?: number | null;
  reject_kg?: number | null;
}

export interface GradeTotals {
  a: number;
  b: number;
  reject: number;
  graded: number;
  records: number;
  rejectPct: number | null;
  gradeAPct: number | null;
}

const clean = (value: unknown): number => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

export const hasGradeSplit = (record: GradeSplit | null | undefined): boolean =>
  !!record && (clean(record.grade_a_kg) > 0 || clean(record.grade_b_kg) > 0 || clean(record.reject_kg) > 0);

export function gradeTotals(records: readonly GradeSplit[]): GradeTotals {
  let a = 0;
  let b = 0;
  let reject = 0;
  let count = 0;
  for (const record of records) {
    if (!hasGradeSplit(record)) continue;
    a += clean(record.grade_a_kg);
    b += clean(record.grade_b_kg);
    reject += clean(record.reject_kg);
    count += 1;
  }
  const graded = a + b + reject;
  return {
    a, b, reject, graded, records: count,
    rejectPct: graded > 0 ? (reject / graded) * 100 : null,
    gradeAPct: graded > 0 ? (a / graded) * 100 : null,
  };
}

export function parseKgField(text: string): number | null {
  const value = text.trim().replace(",", ".");
  if (value === "") return null;
  if (!/^\d*\.?\d+$|^\d+\.$/.test(value)) return Number.NaN;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : Number.NaN;
}

const round = (number: number): string => number.toLocaleString("en-US", { maximumFractionDigits: 1 });

export function validateGradeSplit(
  parts: { a: number | null; b: number | null; reject: number | null },
  totalKg: number,
): string | null {
  const values = [parts.a, parts.b, parts.reject];
  if (values.some((value) => value !== null && Number.isNaN(value))) return "Enter graded weights as plain numbers in kg.";
  const sum = values.reduce<number>((total, value) => total + (value ?? 0), 0);
  if (sum <= 0) return null;
  if (totalKg > 0 && sum > totalKg * 1.02) {
    return `Grade A + B + reject is ${round(sum)} kg, which is more than the ${round(totalKg)} kg harvested.`;
  }
  return null;
}

export function gradeFieldsForSave(parts: { a: number | null; b: number | null; reject: number | null }): GradeSplit {
  const out: GradeSplit = {};
  if (parts.a !== null && parts.a > 0) out.grade_a_kg = parts.a;
  if (parts.b !== null && parts.b > 0) out.grade_b_kg = parts.b;
  if (parts.reject !== null && parts.reject > 0) out.reject_kg = parts.reject;
  return out;
}

export function formatGradeSplit(record: GradeSplit): string {
  const parts: string[] = [];
  if (clean(record.grade_a_kg) > 0) parts.push(`A ${round(clean(record.grade_a_kg))} kg`);
  if (clean(record.grade_b_kg) > 0) parts.push(`B ${round(clean(record.grade_b_kg))} kg`);
  if (clean(record.reject_kg) > 0) parts.push(`Reject ${round(clean(record.reject_kg))} kg`);
  return parts.join(" · ");
}
