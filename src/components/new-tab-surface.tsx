import { ArrowUpRight, Loader2, AtSign } from "lucide-react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { AnimatePresence, motion } from "motion/react";
import Markdown from "react-markdown";
import { CustomAIIcon } from "./custom-ai-icon";
import { cn } from "../lib/utils";
import { useUiPreferences } from "../application/use-ui-preferences";
import { translate } from "../../shared/localization.mjs";

type ModelOption = {
  id: string;
  label: string;
  desc: string;
};

type NewTabMessage = {
  messageId: string;
  role: "user" | "assistant" | "system" | "error";
  text: string;
  skillTrace?: SabrinaSkillTrace;
};

export function NewTabSurface(props: {
  hasConnectedLobster: boolean;
  isModelSwitching: boolean;
  isThinking: boolean;
  modelSelectValue: string;
  models: ModelOption[];
  inputValue: string;
  messages: NewTabMessage[];
  onChangeInput: (value: string) => void;
  onSelectModel: (modelId: string) => void;
  onSubmit: () => void;
}) {
  const {
    hasConnectedLobster,
    isModelSwitching,
    isThinking,
    modelSelectValue,
    models,
    inputValue,
    messages,
    onChangeInput,
    onSelectModel,
    onSubmit,
  } = props;
  const {
    preferences: { uiLocale },
  } = useUiPreferences();

  const visibleMessages = messages.filter((message) => message.role !== "system");
  const isWelcomeState = visibleMessages.length === 0;

  return (
    <div className="surface-screen absolute inset-0 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 relative z-0">
        {isWelcomeState ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-[10%] inset-x-0 h-[500px] bg-gradient-to-b from-apple-pink/10 via-transparent to-transparent blur-[120px] opacity-40" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-apple-blue/[0.04] blur-[140px]" />
            </div>

            <div className="absolute top-6 left-6 z-10">
              <select
                value={modelSelectValue}
                onChange={(event) => onSelectModel(event.target.value)}
                disabled={!hasConnectedLobster || isModelSwitching}
                className="surface-button-system no-drag w-[132px] max-w-[132px] truncate rounded-full border px-3 py-2 text-xs font-medium focus:outline-none cursor-pointer appearance-none transition-colors disabled:opacity-60 disabled:cursor-wait"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id} className="bg-[#1a1a1a] text-white">
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="z-10 flex flex-col items-center w-full max-w-2xl translate-y-[-10%]">
              <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 shadow-2xl backdrop-blur-xl">
                <CustomAIIcon className="w-8 h-8 text-white/80" />
              </div>
              
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent mb-12 tracking-tight text-center">
                {translate(uiLocale, "newTab.welcome")}
              </h1>

              <div className="w-full relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/20 via-pink-500/20 to-blue-500/20 rounded-[28px] blur-md opacity-0 group-hover:opacity-100 transition duration-500"></div>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(event) => onChangeInput(event.target.value)}
                  placeholder={translate(uiLocale, "newTab.heroPlaceholder")}
                  className="relative w-full h-[72px] rounded-[24px] border border-white/10 bg-white/[0.03] backdrop-blur-xl pl-8 pr-20 text-[17px] transition-all placeholder:text-white/30 text-white focus:border-white/20 focus:bg-white/[0.05] shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      onSubmit();
                    }
                  }}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                  <button
                    onClick={onSubmit}
                    disabled={isThinking || isModelSwitching || !inputValue.trim()}
                    className="w-10 h-10 rounded-xl bg-white focus:bg-zinc-200 hover:bg-zinc-200 hover:scale-105 active:scale-95 transition-all text-black flex items-center justify-center disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-md"
                  >
                    {isThinking || isModelSwitching ? (
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 text-black" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <StickToBottom
            className="relative flex-1 min-h-0 overflow-hidden"
            initial="instant"
            resize="smooth"
          >
            <StickToBottom.Content
              scrollClassName="h-full min-h-0 overflow-y-auto no-scrollbar"
              className="min-h-full"
            >
              {visibleMessages.map((message) => (
                <div
                  key={message.messageId}
                  className={cn(
                    "group relative w-full transition-colors",
                    message.role === "user" ? "bg-white/[0.02]" : "bg-transparent",
                  )}
                >
                  <div className="w-full max-w-2xl mx-auto px-6 py-8 md:py-10 flex items-start gap-4 md:gap-8">
                    <div className="mt-1 shrink-0">
                      {message.role === "user" ? (
                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center border border-white/5">
                          <AtSign className="w-4 h-4 text-white/50" />
                        </div>
                      ) : message.role === "error" ? (
                        <CustomAIIcon className="w-7 h-7 rounded-[10px] text-apple-pink" />
                      ) : (
                        <CustomAIIcon className="w-7 h-7 rounded-[10px] text-white/90" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pt-[2px]">
                      {message.role === "user" && (
                        <div className="mb-2 text-[10px] font-bold text-white/25 uppercase tracking-[0.2em] flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-white/20" />
                          {translate(uiLocale, "common.you")}
                        </div>
                      )}
                      <div className={cn(
                        "markdown-body text-[16px] leading-[1.65] font-normal",
                        message.role === "user" ? "text-white/85" : "text-white/95",
                        message.role === "error" && "text-apple-pink/90",
                      )}>
                        <Markdown>{message.text}</Markdown>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {isThinking && (
                <div className="w-full max-w-2xl mx-auto px-6 py-6 border-b border-white/[0.02]">
                  <div className="flex items-start gap-4 md:gap-6">
                    <div className="flex-1 pl-10 md:pl-13 text-white/40 text-sm flex items-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin text-white/50" />
                      <span>{translate(uiLocale, "newTab.processing")}</span>
                    </div>
                  </div>
                </div>
              )}
              {/* Added bottom padding placeholder to prevent composer overlaying last message */}
              <div className="h-32" />
            </StickToBottom.Content>
            <ChatScrollToLatest />
          </StickToBottom>
        )}
      </div>

      <AnimatePresence initial={false}>
        {!isWelcomeState && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute bottom-0 inset-x-0 flex justify-center pb-8 pt-12 px-6 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-transparent pointer-events-none"
          >
            <div className="w-full max-w-2xl surface-panel rounded-[26px] border shadow-2xl p-4 md:px-6 md:py-5 transition-all pointer-events-auto">
              <textarea
                placeholder={translate(uiLocale, "newTab.composerPlaceholder")}
                value={inputValue}
                onChange={(event) => onChangeInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !isModelSwitching && !isThinking) {
                    event.preventDefault();
                    onSubmit();
                  }
                }}
                className="w-full bg-transparent text-[16px] leading-[1.6] focus:outline-none resize-none min-h-[44px] max-h-[280px] placeholder:text-white/20 no-scrollbar caret-apple-pink"
                rows={1}
              />
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <div className="relative group hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/5">
                    <select
                      value={modelSelectValue}
                      onChange={(event) => onSelectModel(event.target.value)}
                      disabled={!hasConnectedLobster || isModelSwitching}
                      className="bg-transparent h-9 w-[150px] max-w-[150px] rounded-xl pl-3 pr-8 text-[12px] font-semibold appearance-none focus:outline-none cursor-pointer transition-all text-white/40 group-hover:text-white/80 disabled:opacity-60 disabled:cursor-wait"
                    >
                      {models.map((model) => (
                        <option key={model.id} value={model.id} className="bg-[#121214] text-white">
                          {model.label}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/20 group-hover:text-white/40 transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6"/>
                      </svg>
                    </div>
                  </div>
                  {isModelSwitching && (
                    <div className="flex items-center gap-2 text-[11px] text-white/30 italic">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {translate(uiLocale, "newTab.switchingModel")}
                    </div>
                  )}
                </div>
                <button
                  onClick={onSubmit}
                  disabled={isThinking || isModelSwitching || !inputValue.trim()}
                  className="surface-button-ai w-9 h-9 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-lg"
                >
                  {isThinking || isModelSwitching ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <ArrowUpRight className="w-4.5 h-4.5 text-white" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChatScrollToLatest() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  const { t } = useUiPreferences();

  return (
    <AnimatePresence>
      {!isAtBottom && (
        <motion.button
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ type: "spring", damping: 24, stiffness: 260 }}
          onClick={() => void scrollToBottom({ animation: "smooth" })}
          className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-black/65 px-3 py-1.5 text-[11px] font-medium text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-all hover:bg-white/10 hover:text-white"
        >
          {t("common.backToLatest")}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
