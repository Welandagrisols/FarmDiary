export const IRRIGATION_METHODS = ["Drip", "Furrow", "Overhead", "Hand / bucket"] as const;
export type IrrigationMethod = (typeof IRRIGATION_METHODS)[number];

export interface IrrigationInput {
  method: IrrigationMethod | "";
  durationMinutes: string;
  waterSource: string;
  ecText: string;
  leachingFlush: boolean;
}

export const emptyIrrigation = (): IrrigationInput => ({
  method: "",
  durationMinutes: "",
  waterSource: "",
  ecText: "",
  leachingFlush: false,
});

const PREFIX = "Irrigation:";
const num = (text: string): number => Number(text.trim().replace(",", "."));

export function hasIrrigationDetails(details: IrrigationInput): boolean {
  return details.method !== "" || details.durationMinutes.trim() !== ""
    || details.waterSource.trim() !== "" || details.ecText.trim() !== "" || details.leachingFlush;
}

export function validateIrrigation(details: IrrigationInput): string | null {
  if (details.durationMinutes.trim()) {
    const minutes = num(details.durationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) {
      return "Duration must be a number of minutes between 1 and 1440, or leave it empty.";
    }
  }
  if (details.ecText.trim()) {
    const ec = num(details.ecText);
    if (!Number.isFinite(ec) || ec < 0 || ec > 100) {
      return "Water EC must be a number in dS/m (for example 1.8), or leave it empty.";
    }
  }
  if (details.waterSource.includes("·") || details.waterSource.includes("\n")) {
    return "Water source cannot contain the · character or a new line.";
  }
  return null;
}

const fmt = (number: number): string => String(Math.round(number * 100) / 100);

export function irrigationLine(details: IrrigationInput): string {
  if (!hasIrrigationDetails(details)) return "";
  const parts: string[] = [];
  if (details.method) parts.push(details.method);
  if (details.durationMinutes.trim()) parts.push(`${fmt(num(details.durationMinutes))} min`);
  if (details.waterSource.trim()) parts.push(`Water: ${details.waterSource.trim()}`);
  if (details.ecText.trim()) parts.push(`EC ${fmt(num(details.ecText))} dS/m`);
  if (details.leachingFlush) parts.push("Leaching flush");
  return `${PREFIX} ${parts.join(" · ")}`;
}

export function composeNotes(line: string, notes: string): string {
  const own = notes.trim();
  if (!line) return notes;
  return own ? `${line}\n${own}` : line;
}

export interface ParsedIrrigation {
  method: IrrigationMethod | null;
  durationMinutes: number | null;
  waterSource: string | null;
  ec: number | null;
  leachingFlush: boolean;
}

export function parseIrrigation(notes: string | null | undefined): ParsedIrrigation | null {
  if (!notes) return null;
  const first = notes.split("\n", 1)[0].trim();
  if (!first.startsWith(PREFIX)) return null;
  const out: ParsedIrrigation = {
    method: null, durationMinutes: null, waterSource: null, ec: null, leachingFlush: false,
  };
  let recognised = 0;
  for (const raw of first.slice(PREFIX.length).split("·")) {
    const part = raw.trim();
    const method = IRRIGATION_METHODS.find((candidate) => candidate === part);
    const minutes = /^(\d+(?:\.\d+)?) min$/.exec(part);
    const ec = /^EC (\d+(?:\.\d+)?) dS\/m$/.exec(part);
    if (method) { out.method = method; recognised += 1; }
    else if (minutes) { out.durationMinutes = Number(minutes[1]); recognised += 1; }
    else if (part.startsWith("Water: ") && part.length > 7) { out.waterSource = part.slice(7).trim(); recognised += 1; }
    else if (ec) { out.ec = Number(ec[1]); recognised += 1; }
    else if (part === "Leaching flush") { out.leachingFlush = true; recognised += 1; }
  }
  return recognised > 0 ? out : null;
}

export interface IrrigationSummary {
  waterings: number;
  withDetails: number;
  leachingFlushes: number;
  totalMinutes: number;
  lastDate: string | null;
  lastEc: number | null;
  lastEcDate: string | null;
}

export function irrigationSummary(
  logs: readonly { activity_category?: string | null; activity_name?: string | null; actual_date: string; notes?: string | null }[],
): IrrigationSummary {
  const out: IrrigationSummary = {
    waterings: 0, withDetails: 0, leachingFlushes: 0, totalMinutes: 0,
    lastDate: null, lastEc: null, lastEcDate: null,
  };
  for (const log of logs) {
    const category = `${log.activity_category ?? ""} ${log.activity_name ?? ""}`;
    if (!/(irrigation|watering)/i.test(category)) continue;
    out.waterings += 1;
    if (!out.lastDate || log.actual_date > out.lastDate) out.lastDate = log.actual_date;
    const parsed = parseIrrigation(log.notes);
    if (!parsed) continue;
    out.withDetails += 1;
    if (parsed.leachingFlush) out.leachingFlushes += 1;
    if (parsed.durationMinutes) out.totalMinutes += parsed.durationMinutes;
    if (parsed.ec !== null && (!out.lastEcDate || log.actual_date >= out.lastEcDate)) {
      out.lastEc = parsed.ec;
      out.lastEcDate = log.actual_date;
    }
  }
  return out;
}
