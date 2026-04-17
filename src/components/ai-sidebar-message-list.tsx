import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, AtSign, Bot, Loader2, MessageSquare, Wand2, X } from "lucide-react";
import Markdown from "react-markdown";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { cn } from "../lib/utils";
import { CustomAIIcon } from "./custom-ai-icon";
import { LobsterHandoffIcon } from "./lobster-handoff-icon";
import { AgentActionStream } from "./agent-action-stream";
import type { SidebarMessage } from "./ai-sidebar-types";
import { useUiPreferences } from "../application/use-ui-preferences";
import { translate } from "../../shared/localization.mjs";

export function AiSidebarMessageList(props: {
  chatKey: string;
  isThinking: boolean;
  visibleMessages: SidebarMessage[];
  agentState?: any;
  onStopTurn: () => void;
}) {
  const { chatKey, isThinking, visibleMessages, agentState, onStopTurn } = props;
  const {
    preferences: { uiLocale },
  } = useUiPreferences();
  const [expandedTraceIds, setExpandedTraceIds] = useState<string[]>([]);

  useEffect(() => {
    setExpandedTraceIds([]);
  }, [chatKey]);

  return (
    <StickToBottom
      key={chatKey}
      className="relative flex-1 min-h-0 overflow-hidden"
      initial="instant"
      resize="smooth"
    >
      <StickToBottom.Content
        scrollClassName="h-full min-h-0 overflow-y-auto no-scrollbar"
        className="min-h-full"
      >
        {visibleMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 space-y-4 py-20">
            <MessageSquare className="w-12 h-12" />
            <p className="text-sm px-6">
              {translate(uiLocale, "sidebar.askAboutPage")}
              <br />
              {translate(uiLocale, "sidebar.anyQuestion")}
            </p>
          </div>
        ) : null}

        {visibleMessages.map((message) => (
          <div
            key={message.messageId}
            className={cn(
              "group relative px-6 py-5 transition-colors border-b border-white/[0.02]",
              message.role === "user" ? "bg-white/[0.02]" : "bg-transparent",
            )}
          >
            <div className="flex items-start gap-4">
              <div className="mt-1 shrink-0">
                {message.role === "user" ? (
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center",
                    message.mode === "agent" ? "bg-[#FF2D55]/15" :
                    message.mode === "claw" ? "bg-violet-500/15" :
                    message.mode === "gentab" ? "bg-apple-pink/15" :
                    "bg-white/10"
                  )}>
                    {message.mode === "agent" ? <Bot className="w-3 h-3 text-[#FF2D55]" /> :
                     message.mode === "claw" ? <LobsterHandoffIcon className="w-3 h-3 text-violet-400" /> :
                     message.mode === "gentab" ? <Wand2 className="w-3 h-3 text-apple-pink" /> :
                     <AtSign className="w-3 h-3 text-white/40" />}
                  </div>
                ) : message.role === "error" ? (
                  <X className="w-5 h-5 text-apple-pink" />
                ) : (
                  <CustomAIIcon className="w-5 h-5 rounded-md" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                {message.role === "user" ? (
                  <div className={cn(
                    "mb-1 text-[10px] font-bold uppercase tracking-widest",
                    message.mode === "agent" ? "text-[#FF2D55]/80" :
                    message.mode === "claw" ? "text-violet-400/80" :
                    message.mode === "gentab" ? "text-apple-pink/80" :
                    "text-white/20"
                  )}>
                    {translate(uiLocale, "common.you")} {
                      message.mode === "agent" ? "(Agent)" :
                      message.mode === "claw" ? "(Claw)" :
                      message.mode === "gentab" ? "(GenTab)" : ""
                    }
                  </div>
                ) : null}
                <div
                  className={cn(
                    "markdown-body text-[13px] leading-relaxed",
                    message.role === "user" ? "text-white/70" : "text-white/85",
                    message.role === "error" && "text-apple-pink/90",
                  )}
                >
                  <Markdown>{message.text}</Markdown>
                </div>
                {message.role === "assistant" && message.skillTrace ? (
                  <SkillTraceMeta
                    expanded={expandedTraceIds.includes(message.messageId)}
                    trace={message.skillTrace}
                    onToggle={() => {
                      setExpandedTraceIds((current) =>
                        current.includes(message.messageId)
                          ? current.filter((entry) => entry !== message.messageId)
                          : [...current, message.messageId],
                      );
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>
        ))}

        {agentState?.activeTaskId ? (
          <div className="px-5 py-2">
            <AgentActionStream
              journal={agentState.journal}
              status={agentState.status}
              taskTree={agentState.taskTree}
              pendingConfirm={agentState.pendingConfirm}
              onConfirm={agentState.respondConfirm}
              onStop={agentState.stopTask}
            />
          </div>
        ) : null}

        {isThinking ? (
          <div className="px-10 py-6 flex flex-col items-start gap-2 text-white/30 text-xs">
            <div className="flex items-center gap-3 w-full group">
              <Loader2 className="w-4 h-4 animate-spin opacity-50" />
              <span className="flex-1">{translate(uiLocale, "newTab.processing")}</span>
            </div>
            <div className="pl-7 text-[10px] text-white/20">
              {translate(uiLocale, "newTab.processingHint")}
            </div>
          </div>
        ) : null}
      </StickToBottom.Content>
      <ChatScrollToLatest />
    </StickToBottom>
  );
}

function SkillTraceMeta(props: {
  trace: SabrinaSkillTrace;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { expanded, onToggle, trace } = props;
  const {
    preferences: { uiLocale },
  } = useUiPreferences();
  const statusLabel =
    trace.status === "used"
      ? translate(uiLocale, "chat.skillUsed")
      : trace.status === "fallback"
        ? translate(uiLocale, "chat.skillFallback")
        : trace.status === "failed"
          ? translate(uiLocale, "chat.skillFailed")
          : translate(uiLocale, "chat.skillRequested");

  return (
    <div className="mt-3 rounded-xl border border-white/6 bg-white/[0.025] px-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0 text-[10px] text-white/42">
          <span className="font-medium text-white/48">{`skill: ${trace.skillName}`}</span>
          <span className="mx-1.5 text-white/20">·</span>
          <span>{statusLabel}</span>
        </div>
        <span className="shrink-0 text-[10px] text-white/28">
          {expanded
            ? translate(uiLocale, "common.collapse")
            : translate(uiLocale, "common.details")}
        </span>
      </button>

      {expanded ? (
        <div className="mt-2 space-y-1.5 border-t border-white/6 pt-2">
          {trace.steps.map((step, index) => (
            <div key={`${trace.runId}:${step.type}:${index}`} className="text-[10px] leading-4 text-white/38">
              <div className="text-white/48">{formatSkillTraceHeadline(step)}</div>
              {step.detail ? (
                <div className="mt-0.5 truncate text-white/28" title={step.detail}>
                  {step.detail}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatSkillTraceHeadline(step: SabrinaSkillTraceStep) {
  const parts = [step.title];
  if (typeof step.exitCode === "number") {
    parts.push(`exit ${step.exitCode}`);
  }
  if (typeof step.durationMs === "number") {
    parts.push(`${step.durationMs}ms`);
  }

  return parts.join(" · ");
}

function ChatScrollToLatest() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  const {
    preferences: { uiLocale },
  } = useUiPreferences();

  return (
    <AnimatePresence>
      {!isAtBottom ? (
        <motion.button
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ type: "spring", damping: 24, stiffness: 260 }}
          onClick={() => void scrollToBottom({ animation: "smooth" })}
          className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-black/65 px-3 py-1.5 text-[11px] font-medium text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-all hover:bg-white/10 hover:text-white"
        >
          <span className="flex items-center gap-1.5">
            <ArrowDown className="h-3.5 w-3.5" />
            {translate(uiLocale, "common.backToLatest")}
          </span>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
