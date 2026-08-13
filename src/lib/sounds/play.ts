import type { SoundSlot } from "@/lib/sounds/slots";

type PlayFn = (slot: SoundSlot) => void;

let playImpl: PlayFn | null = null;

export function registerUiSoundPlayer(fn: PlayFn | null) {
  playImpl = fn;
}

/** Fire-and-forget UI sound; no-op until SoundProvider registers. */
export function playUiSound(slot: SoundSlot) {
  try {
    playImpl?.(slot);
  } catch {
    // ignore
  }
}
