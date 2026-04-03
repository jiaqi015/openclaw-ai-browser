import type { SystemEntryIconName } from "../application/browser-surface";
import { cn } from "../lib/utils";

export function SystemEntryIcon(props: {
  name: SystemEntryIconName;
  className?: string;
  variant?: "menu" | "tab";
}) {
  const { className, name, variant = "menu" } = props;
  const glyphStroke = "#F5F7FB";
  const glyphScale = variant === "tab" ? 1.34 : 1.18;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <g transform={`translate(12 12) scale(${glyphScale}) translate(-12 -12)`}>
        {renderGlyph(name, glyphStroke)}
      </g>
    </svg>
  );
}

function renderGlyph(name: SystemEntryIconName, stroke: string) {
  switch (name) {
    case "newtab":
      return (
        <>
          <path d="M12 9.2V15.2" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M9 12.2H15" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M15.9 9V10.35" stroke={stroke} strokeWidth="1.25" strokeLinecap="round" />
          <path d="M15.225 9.675H16.575" stroke={stroke} strokeWidth="1.25" strokeLinecap="round" />
        </>
      );
    case "history":
      return (
        <>
          <path d="M8.7 10.25A4.15 4.15 0 1 1 8.55 14" stroke={stroke} strokeWidth="1.45" strokeLinecap="round" />
          <path d="M8.7 8.75V10.8H6.6" stroke={stroke} strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 10.45V12.7L13.7 13.75" stroke={stroke} strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "bookmarks":
      return (
        <path
          d="M9.25 8.55H14.75C15.2471 8.55 15.65 8.95294 15.65 9.45V16.15L12 13.95L8.35 16.15V9.45C8.35 8.95294 8.75294 8.55 9.25 8.55Z"
          stroke={stroke}
          strokeWidth="1.45"
          strokeLinejoin="round"
        />
      );
    case "downloads":
      return (
        <>
          <path d="M12 8.7V13.65" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M9.95 11.7L12 13.75L14.05 11.7" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.8 15.4V16C8.8 16.6075 9.29249 17.1 9.9 17.1H14.1C14.7075 17.1 15.2 16.6075 15.2 16V15.4" stroke={stroke} strokeWidth="1.45" strokeLinecap="round" />
        </>
      );
    case "diagnostics":
      return (
        <path
          d="M8.1 13.35H9.8L11.05 10.55L12.45 15.15L13.75 12.45H15.9"
          stroke={stroke}
          strokeWidth="1.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "general-settings":
      return (
        <>
          <path d="M8.2 10H15.8" stroke={stroke} strokeWidth="1.45" strokeLinecap="round" />
          <path d="M8.2 14.45H15.8" stroke={stroke} strokeWidth="1.45" strokeLinecap="round" />
          <circle cx="10.25" cy="10" r="1.15" fill={stroke} />
          <circle cx="13.95" cy="14.45" r="1.15" fill={stroke} />
        </>
      );
    case "settings":
      return (
        <>
          <path d="M10.25 9.25L9.35 8.05" stroke={stroke} strokeWidth="1.25" strokeLinecap="round" />
          <path d="M13.75 9.25L14.65 8.05" stroke={stroke} strokeWidth="1.25" strokeLinecap="round" />
          <path
            d="M12 9.1C10.5098 9.1 9.3 10.2872 9.3 11.75V12.7C9.3 14.1018 10.2482 15.1716 11.575 15.4711V16.85H12.425V15.4711C13.7518 15.1716 14.7 14.1018 14.7 12.7V11.75C14.7 10.2872 13.4902 9.1 12 9.1Z"
            stroke={stroke}
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
          <path d="M10.55 12.15H13.45" stroke={stroke} strokeWidth="1.25" strokeLinecap="round" />
          <path d="M10.85 13.55H13.15" stroke={stroke} strokeWidth="1.25" strokeLinecap="round" />
        </>
      );
    case "skills":
      return (
        <path
          d="M12 8.55L12.85 10.75L15.05 11.6L12.85 12.45L12 14.65L11.15 12.45L8.95 11.6L11.15 10.75L12 8.55Z"
          stroke={stroke}
          strokeWidth="1.45"
          strokeLinejoin="round"
        />
      );
    case "clear-history":
      return (
        <>
          <path d="M8.5 9.15H15.5" stroke={stroke} strokeWidth="1.45" strokeLinecap="round" />
          <path d="M10 9.15V8.55C10 8.13579 10.3358 7.8 10.75 7.8H13.25C13.6642 7.8 14 8.13579 14 8.55V9.15" stroke={stroke} strokeWidth="1.35" strokeLinecap="round" />
          <path d="M9.25 10.2L9.7 15.7C9.75201 16.3357 10.2826 16.825 10.9204 16.825H13.0796C13.7174 16.825 14.248 16.3357 14.3 15.7L14.75 10.2" stroke={stroke} strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11.1 11.35V14.75" stroke={stroke} strokeWidth="1.25" strokeLinecap="round" />
          <path d="M12.9 11.35V14.75" stroke={stroke} strokeWidth="1.25" strokeLinecap="round" />
        </>
      );
    case "download-latest":
      return (
        <>
          <path d="M12 15.15V9.45" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M9.95 11.45L12 9.4L14.05 11.45" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.9 16.45H15.1" stroke={stroke} strokeWidth="1.45" strokeLinecap="round" />
        </>
      );
    default:
      return null;
  }
}
