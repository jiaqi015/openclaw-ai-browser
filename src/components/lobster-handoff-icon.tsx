import { cn } from "../lib/utils";

export function LobsterHandoffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <path
        d="M10.3 8.85L9.35 7.55M13.7 8.85L14.65 7.55"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M12 8.75C10.4549 8.75 9.2 9.98159 9.2 11.5V12.45C9.2 13.9078 10.1942 15.0283 11.55 15.347V16.65H12.45V15.347C13.8058 15.0283 14.8 13.9078 14.8 12.45V11.5C14.8 9.98159 13.5451 8.75 12 8.75Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path d="M10.55 12.05H13.45M10.85 13.45H13.15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="12" cy="16.3" r="3.6" stroke="currentColor" strokeWidth="1.45" />
      <circle cx="12" cy="16.3" r="0.82" fill="currentColor" />
      <path
        d="M12 12.6V14.8M8.8 16.3H10.85M13.15 16.3H15.2M9.8 14.15L11.2 15.25M14.2 14.15L12.8 15.25"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  );
}
