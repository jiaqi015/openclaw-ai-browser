import { ArrowUpRight, Loader2, AtSign } from "lucide-react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { AnimatePresence, motion } from "motion/react";
import Markdown from "react-markdown";
import { CustomAIIcon } from "./custom-ai-icon";
import { cn } from "../lib/utils";

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

  const visibleMessages = messages.filter((message) => message.role !== "system");
  const isWelcomeState = visibleMessages.length === 0;

  return (
    <div className="surface-screen absolute inset-0 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 relative">
        {isWelcomeState ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
            <div className="absolute top-6 left-6">
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
            <h1 className="text-4xl md:text-5xl font-semibold text-white mb-10 tracking-tighter">
              今天想了解点什么？
            </h1>
            <div className="w-full max-w-4xl relative group">
              <input
                type="text"
                value={inputValue}
                onChange={(event) => onChangeInput(event.target.value)}
                placeholder="输入网址或者和你的龙虾对话"
                className="surface-input-hero w-full h-16 rounded-2xl border pl-6 pr-14 text-lg transition-all placeholder:text-white/30"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onSubmit();
                  }
                }}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  onClick={onSubmit}
                  className="surface-button-ai p-2.5 rounded-xl transition-colors"
                >
                  <ArrowUpRight className="w-5 h-5" />
                </button>
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
                    "group relative px-6 py-5 transition-colors border-b border-white/[0.02]",
                    message.role === "user" ? "bg-white/[0.02]" : "bg-transparent",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1 shrink-0">
                      {message.role === "user" ? (
                        <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                          <AtSign className="w-3 h-3 text-white/40" />
                        </div>
                      ) : message.role === "error" ? (
                        <CustomAIIcon className="w-5 h-5 rounded-md text-apple-pink" />
                      ) : (
                        <CustomAIIcon className="w-5 h-5 rounded-md" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {message.role === "user" && (
                        <div className="mb-1 text-[10px] font-bold text-white/20 uppercase tracking-widest">
                          你
                        </div>
                      )}
                      <div className={cn(
                        "markdown-body text-[15px] leading-relaxed",
                        message.role === "user" ? "text-white/70" : "text-white/85",
                        message.role === "error" && "text-apple-pink/90",
                      )}>
                        <Markdown>{message.text}</Markdown>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {isThinking && (
                <div className="px-10 py-6 flex flex-col items-start gap-2 text-white/30 text-xs">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin opacity-50" />
                    <span>Sabrina 正在处理请求...</span>
                  </div>
                  <div className="pl-7 text-[10px] text-white/20">
                    技能执行完整编排通常需要几十秒，请耐心等候
                  </div>
                </div>
              )}
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
            className="shrink-0 px-5 pt-3 pb-4 border-t border-white/5"
          >
            <div className="surface-panel rounded-2xl border p-3 transition-all">
              <textarea
                placeholder="继续提问..."
                value={inputValue}
                onChange={(event) => onChangeInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !isModelSwitching && !isThinking) {
                    event.preventDefault();
                    onSubmit();
                  }
                }}
                className="w-full bg-transparent text-sm focus:outline-none resize-none min-h-[60px] max-h-[200px] placeholder:text-white/40 no-scrollbar"
                rows={2}
              />
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <div className="relative group">
                    <select
                      value={modelSelectValue}
                      onChange={(event) => onSelectModel(event.target.value)}
                      disabled={!hasConnectedLobster || isModelSwitching}
                      className="surface-button-system h-8 w-[128px] max-w-[128px] rounded-lg border pl-3 pr-8 text-[11px] font-medium appearance-none focus:outline-none cursor-pointer transition-all text-white/80 disabled:opacity-60 disabled:cursor-wait"
                    >
                      {models.map((model) => (
                        <option key={model.id} value={model.id} className="bg-[#1a1a1a] text-white">
                          {model.label}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                      <ArrowUpRight className="w-3 h-3 rotate-90" />
                    </div>
                  </div>
                  {isModelSwitching && (
                    <div className="flex items-center gap-1.5 text-[11px] text-white/45">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      正在切换模型...
                    </div>
                  )}
                </div>
                <button
                  onClick={onSubmit}
                  disabled={isThinking || isModelSwitching || !inputValue.trim()}
                  className="surface-button-ai w-8 h-8 rounded-lg flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                >
                  {isThinking || isModelSwitching ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-white" />
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
          回到最新
        </motion.button>
      )}
    </AnimatePresence>
  );
}
