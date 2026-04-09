"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && node !== null && "props" in node) {
    const el = node as { props?: { children?: React.ReactNode } };
    return extractText(el.props?.children);
  }
  return "";
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (insecure context, permission denied, etc.)
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 rounded-md bg-muted-foreground/10 p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted-foreground/20 hover:text-foreground group-hover:opacity-100"
      aria-label="Copy code"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

const mdComponents: Components = {
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className={`${className ?? ""}`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => {
    const textContent = extractText(children);
    return (
      <div className="group relative my-3">
        <CopyButton text={textContent} />
        <pre className="max-w-full overflow-x-auto rounded-lg bg-muted p-4 font-mono text-[13px] leading-relaxed">
          {children}
        </pre>
      </div>
    );
  },
  ul: ({ children }) => <ul className="my-2 list-disc space-y-0.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-0.5 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  table: ({ children }) => (
    <div className="my-3 max-w-full overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 text-left text-xs font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-b border-border/50 px-3 py-2">{children}</td>,
  h1: ({ children }) => (
    <h1 className="mb-3 mt-5 text-lg font-bold tracking-tight text-foreground">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 text-base font-semibold tracking-tight text-foreground">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1.5 mt-3 text-sm font-semibold text-foreground">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-2 text-sm font-semibold text-foreground">{children}</h4>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary underline decoration-primary/30 underline-offset-2 transition-colors duration-150 hover:decoration-primary"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-border pl-4 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
};

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="max-w-prose text-sm leading-relaxed text-foreground/90">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
