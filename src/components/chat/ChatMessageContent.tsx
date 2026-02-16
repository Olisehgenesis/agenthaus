"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface ChatMessageContentProps {
  content: string;
  className?: string;
  /** For user messages (dark bg) vs assistant (light bg) - affects link/code colors */
  variant?: "user" | "assistant";
}

/**
 * Renders chat message content with full markdown support (bold, italic, lists, code, links).
 * Used across all chat UIs: ContentTabs, Agent detail page, Beta create page.
 */
export function ChatMessageContent({
  content,
  className,
  variant = "assistant",
}: ChatMessageContentProps) {
  const isUser = variant === "user";
  const textCls = isUser ? "text-white/95" : "text-forest/90";
  const strongCls = isUser ? "text-white font-semibold" : "text-forest font-semibold";
  const codeInlineCls = isUser
    ? "bg-white/20 text-white/95 px-1.5 py-0.5 rounded text-[0.9em] font-mono"
    : "bg-forest/10 text-forest px-1.5 py-0.5 rounded text-[0.9em] font-mono";
  const codeBlockCls = isUser
    ? "block p-3 rounded-lg overflow-x-auto text-[0.85em] font-mono bg-white/10 text-white/90"
    : "block p-3 rounded-lg overflow-x-auto text-[0.85em] font-mono bg-forest/5 text-forest/90";
  const linkCls = isUser ? "text-white/90 underline hover:opacity-90" : "text-forest-light underline hover:opacity-90";

  return (
    <div className={cn("text-sm [&_p]:my-1 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className={cn("whitespace-pre-wrap break-words leading-relaxed", textCls)}>{children}</p>,
          strong: ({ children }) => <strong className={strongCls}>{children}</strong>,
          em: ({ children }) => <em className={textCls}>{children}</em>,
          code: ({ className: codeClassName, children, ...props }) => {
            const isInline = !codeClassName;
            return (
              <code
                className={isInline ? codeInlineCls : codeBlockCls}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-0.5">{children}</ol>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={linkCls}
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
