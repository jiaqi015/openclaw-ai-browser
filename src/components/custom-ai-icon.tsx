import { cn } from "../lib/utils";
import { useUiPreferences } from "../application/use-ui-preferences";

export function ChatTextIcon({ className }: { className?: string }) {
  const {
    preferences: { uiLocale },
  } = useUiPreferences();
  const label = uiLocale === "en-US" ? "Ask Claw" : "问问 Claw";

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <span className="whitespace-nowrap text-[11px] font-bold leading-none text-apple-pink drop-shadow-[0_0_8px_rgba(255,42,133,0.3)]">
        {label}
      </span>
    </div>
  );
}

export function CustomAIIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="100" height="100" rx="22" fill="url(#ai-grad)" />
      <path d="M 0 0 H 100 V 45 Q 50 60 0 45 Z" fill="white" fillOpacity="0.15" />
      <path d="M 24 24 V 76 H 48 V 62 H 38 V 24 Z" fill="white" />
      <path d="M 76 24 V 76 H 52 V 62 H 62 V 24 Z" fill="white" />
      <defs>
        <linearGradient id="ai-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF2A85" />
          <stop offset="1" stopColor="#FF5A00" />
        </linearGradient>
      </defs>
    </svg>
  );
}
