"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; title?: string };
type State = { hasError: boolean };

export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center p-4 text-sm text-[var(--muted)]">
          {this.props.title ?? "Panel"} couldn&apos;t load. Try refreshing.
        </div>
      );
    }
    return this.props.children;
  }
}
