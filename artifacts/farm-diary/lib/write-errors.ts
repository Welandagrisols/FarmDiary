import { Alert } from "react-native";
import { CLOSED_SEASON_MESSAGE } from "./season-rules";
import { formatWriteError } from "./write-error-message";

/** Keeps actionable database details while giving network failures a clear retry message. */
export function writeErrorMessage(error: unknown, fallback: string): string {
  return formatWriteError(error, fallback, CLOSED_SEASON_MESSAGE);
}

export function reportWriteError(error: unknown, fallback: string, title = "Could not save"): void {
  Alert.alert(title, writeErrorMessage(error, fallback));
}
