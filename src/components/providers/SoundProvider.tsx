"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_CLICK_SRC,
  type SoundSlot,
} from "@/lib/sounds/slots";
import { registerUiSoundPlayer } from "@/lib/sounds/play";
import {
  fetchSoundBindings,
  resolveSoundUrl,
} from "@/lib/sounds/storage";

type SoundContextValue = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  play: (slot: SoundSlot) => void;
  reloadBindings: () => Promise<void>;
  urlForSlot: (slot: SoundSlot) => string;
};

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundProvider({
  enabled: enabledProp,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [enabled, setEnabled] = useState(enabledProp);
  const [urls, setUrls] = useState<Partial<Record<SoundSlot, string>>>({});
  const urlsRef = useRef(urls);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    setEnabled(enabledProp);
  }, [enabledProp]);

  useEffect(() => {
    urlsRef.current = urls;
  }, [urls]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const reloadBindings = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUrls({});
      return;
    }
    const bindings = await fetchSoundBindings(supabase, user.id);
    const next: Partial<Record<SoundSlot, string>> = {};
    await Promise.all(
      bindings.map(async (binding) => {
        const slot = binding.slot as SoundSlot;
        const url = await resolveSoundUrl(supabase, binding.storage_path);
        if (url) next[slot] = url;
      }),
    );
    setUrls(next);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setUrls({});
      return;
    }
    void reloadBindings();
  }, [enabled, reloadBindings]);

  const urlForSlot = useCallback((slot: SoundSlot) => {
    const map = urlsRef.current;
    if (slot !== "generic_click" && map[slot]) return map[slot]!;
    if (map.generic_click) return map.generic_click;
    if (map[slot]) return map[slot]!;
    return DEFAULT_CLICK_SRC;
  }, []);

  const play = useCallback(
    (slot: SoundSlot) => {
      if (!enabledRef.current) return;
      const src = urlForSlot(slot);
      try {
        const audio = new Audio(src);
        audio.volume = 0.85;
        void audio.play().catch(() => {
          // autoplay / missing file — ignore
        });
      } catch {
        // ignore
      }
    },
    [urlForSlot],
  );

  useEffect(() => {
    registerUiSoundPlayer(play);
    return () => registerUiSoundPlayer(null);
  }, [play]);

  const value = useMemo(
    () => ({
      enabled,
      setEnabled,
      play,
      reloadBindings,
      urlForSlot,
    }),
    [enabled, play, reloadBindings, urlForSlot],
  );

  return (
    <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
  );
}

export function useSound() {
  const ctx = useContext(SoundContext);
  if (!ctx) {
    return {
      enabled: false,
      setEnabled: () => {},
      play: (_slot: SoundSlot) => {},
      reloadBindings: async () => {},
      urlForSlot: (_slot: SoundSlot) => DEFAULT_CLICK_SRC,
    };
  }
  return ctx;
}
