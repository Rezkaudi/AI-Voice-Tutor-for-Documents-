import { useEffect, useRef } from "react";
import { renderMessageBody } from "@/lib/messageFormat";
import { cx } from "@/lib/uiClasses";
import type { ChatMessage } from "@/lib/types";
import { bubbleBase, callHint } from "./styles";

interface TranscriptLogProps {
  messages: ChatMessage[];
}

/** Scrollable lesson transcript. Auto-scrolls to the latest message. */
export function TranscriptLog({ messages }: TranscriptLogProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  const visible = messages.filter((message) => !message.hidden);

  return (
    <div
      ref={logRef}
      className="flex min-h-0 w-full flex-auto flex-col gap-2.5 overflow-y-auto overscroll-contain px-1 pb-3 pt-1 [scrollbar-color:oklch(0.5_0.04_230)_transparent] scrollbar-thin [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[oklch(0.5_0.04_230/0.6)] [&::-webkit-scrollbar]:w-1.5"
      aria-live="polite"
    >
      {visible.length === 0 ? (
        <p className={callHint}>
          No conversation yet — your lesson transcript will appear here.
        </p>
      ) : (
        visible.map((message) => <TranscriptBubble key={message.id} message={message} />)
      )}
    </div>
  );
}

function TranscriptBubble({ message }: { message: ChatMessage }) {
  const assistant = message.role === "assistant";
  return (
    <div
      className={cx(
        bubbleBase,
        assistant
          ? "self-start rounded-bl bg-[oklch(0.34_0.035_232)] text-[oklch(0.96_0.008_100)] border border-[oklch(0.44_0.04_230)]"
          : "self-end rounded-br bg-accent text-[oklch(0.98_0.008_138)]"
      )}
    >
      {message.content ? (
        renderMessageBody(message.content, message.reference?.citations ?? [])
      ) : assistant ? (
        <TypingDots />
      ) : (
        ""
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1" aria-label="Thinking">
      <i className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-current opacity-55" />
      <i className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-current opacity-55 [animation-delay:0.15s]" />
      <i className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-current opacity-55 [animation-delay:0.3s]" />
    </span>
  );
}
