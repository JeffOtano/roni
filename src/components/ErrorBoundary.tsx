"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isDev = process.env.NODE_ENV === "development";

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-7 text-destructive" />
          </div>

          <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
            Something went wrong
          </h1>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            An unexpected error occurred. Try refreshing or head back to the chat.
          </p>

          {isDev && this.state.error && (
            <pre className="mb-6 max-w-full overflow-auto rounded-lg bg-white/4 p-4 text-left text-xs text-muted-foreground ring-1 ring-white/8">
              {this.state.error.message}
            </pre>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={this.handleReset} className="gap-2">
              <RefreshCw className="size-4" />
              Try again
            </Button>
            <Button render={<Link href="/chat" />}>Go home</Button>
          </div>
        </div>
      </div>
    );
  }
}
