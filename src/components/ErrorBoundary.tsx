"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  children: ReactNode;
  /** Changing this resets the boundary, e.g. after switching module. */
  resetKey?: string | number;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors from the GLB packs. The previous version had no reset
 * path, so a single failed model download left the viewer permanently broken
 * until a full page reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Scene error:", error, info.componentStack);
    }
  }

  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}
