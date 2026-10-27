import { Alert } from "react-native";
import { CLOSED_SEASON_MESSAGE } from "./season-rules";

/** Shows the closed-cycle explanation when that is why a save was refused; otherwise the screen's own wording. */
export function writeErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message === CLOSED_SEASON_MESSAGE ? error.message : fallback;
}

export function reportWriteError(error: unknown, fallback: string, title = "Could not save"): void {
  Alert.alert(title, writeErrorMessage(error, fallback));
}
