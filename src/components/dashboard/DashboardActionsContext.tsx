"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PanelType } from "@/lib/panels/types";

type AddPanelFn = (type: PanelType) => void | Promise<void>;

type DashboardActionsContextValue = {
  canAddPanel: boolean;
  registerAddPanel: (fn: AddPanelFn | null) => void;
  addPanel: (type: PanelType) => void;
};

const DashboardActionsContext =
  createContext<DashboardActionsContextValue | null>(null);

export function DashboardActionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [handler, setHandler] = useState<AddPanelFn | null>(null);

  const registerAddPanel = useCallback((fn: AddPanelFn | null) => {
    setHandler(() => fn);
  }, []);

  const addPanel = useCallback(
    (type: PanelType) => {
      if (handler) void handler(type);
    },
    [handler],
  );

  const value = useMemo(
    () => ({
      canAddPanel: Boolean(handler),
      registerAddPanel,
      addPanel,
    }),
    [handler, registerAddPanel, addPanel],
  );

  return (
    <DashboardActionsContext.Provider value={value}>
      {children}
    </DashboardActionsContext.Provider>
  );
}

export function useDashboardActions() {
  const ctx = useContext(DashboardActionsContext);
  if (!ctx) {
    throw new Error(
      "useDashboardActions must be used within DashboardActionsProvider",
    );
  }
  return ctx;
}
