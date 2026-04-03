import { ArrowUpRight, Clock, Download, Star, X } from "lucide-react";
import { useUiPreferences } from "../application/use-ui-preferences";
import { cn } from "../lib/utils";

type BrowserLibrarySurfaceMode = "history" | "bookmarks" | "downloads";

function formatByteSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function getDownloadStateLabel(
  state: SabrinaDownloadEntry["state"],
  t: (key: string, params?: Record<string, unknown>) => string,
) {
  if (state === "completed") {
    return t("library.download.completed");
  }

  if (state === "cancelled") {
    return t("library.download.cancelled");
  }

  if (state === "interrupted") {
    return t("library.download.interrupted");
  }

  return t("library.download.inProgress");
}

export function BrowserLibrarySurface(props: {
  mode: BrowserLibrarySurfaceMode;
  bookmarkEntries: SabrinaBookmarkEntry[];
  downloads: SabrinaDownloadEntry[];
  historyEntries: SabrinaHistoryEntry[];
  onNavigate: (url: string) => void;
  onOpenDownload: (downloadId: string) => void;
  onRemoveBookmark: (url: string) => void;
  onRevealDownload: (downloadId: string) => void;
}) {
  const {
    bookmarkEntries,
    downloads,
    historyEntries,
    mode,
    onNavigate,
    onOpenDownload,
    onRemoveBookmark,
    onRevealDownload,
  } = props;
  const {
    preferences: { uiLocale },
    t,
  } = useUiPreferences();

  if (mode === "history") {
    return (
      <div className="surface-screen absolute inset-0 overflow-y-auto p-10">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-8 text-3xl font-semibold text-white">{t("library.historyTitle")}</h1>
          {historyEntries.length === 0 ? (
            <p className="text-white/40">{t("library.historyEmpty")}</p>
          ) : (
            <div className="space-y-2">
              {historyEntries.map((item) => (
                <div
                  key={item.id}
                  className="flex cursor-pointer items-center gap-4 rounded-xl p-3 transition-colors hover:bg-white/5"
                  onClick={() => onNavigate(item.url)}
                >
                  <Clock className="h-5 w-5 text-white/40" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-white">{item.title}</div>
                    <div className="truncate text-xs text-white/40">{item.url}</div>
                  </div>
                  <div className="whitespace-nowrap text-xs text-white/30">
                    {new Date(item.visitedAt).toLocaleTimeString(uiLocale)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === "bookmarks") {
    return (
      <div className="surface-screen absolute inset-0 overflow-y-auto p-10">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-8 text-3xl font-semibold text-white">{t("library.bookmarksTitle")}</h1>
          {bookmarkEntries.length === 0 ? (
            <p className="text-white/40">{t("library.bookmarksEmpty")}</p>
          ) : (
            <div className="space-y-2">
              {bookmarkEntries.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="group flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-white/5"
                >
                  <div
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-4"
                    onClick={() => onNavigate(bookmark.url)}
                  >
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <div className="truncate text-sm text-white">{bookmark.url}</div>
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveBookmark(bookmark.url);
                    }}
                    className="p-2 text-white/40 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="surface-screen absolute inset-0 overflow-y-auto p-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-semibold text-white">{t("library.downloadsTitle")}</h1>
        {downloads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/40">
            <Download className="mb-4 h-12 w-12 opacity-50" />
            <p>{t("library.downloadsEmpty")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {downloads.map((download) => {
              const canOpenDownload = Boolean(download.savePath) && download.state === "completed";
              const canRevealDownload = Boolean(download.savePath);

              return (
                <div
                  key={download.id}
                  className="flex items-center gap-4 rounded-xl p-3 transition-colors hover:bg-white/5"
                >
                  <button
                    onClick={() => {
                      if (canOpenDownload) {
                        onOpenDownload(download.id);
                      }
                    }}
                    disabled={!canOpenDownload}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-4 text-left",
                      !canOpenDownload && "cursor-default opacity-80",
                    )}
                  >
                    <Download className="h-5 w-5 shrink-0 text-white/40" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-white">{download.fileName}</div>
                      <div className="truncate text-xs text-white/40">{download.url}</div>
                    </div>
                    <div className="whitespace-nowrap text-right text-xs">
                      <div className="text-white/60">{getDownloadStateLabel(download.state, t)}</div>
                      <div className="text-white/30">
                        {download.totalBytes > 0
                          ? `${formatByteSize(download.receivedBytes)} / ${formatByteSize(download.totalBytes)}`
                          : formatByteSize(download.receivedBytes)}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      if (canRevealDownload) {
                        onRevealDownload(download.id);
                      }
                    }}
                    disabled={!canRevealDownload}
                    className={cn(
                      "p-2 text-white/40 transition-colors",
                      canRevealDownload ? "hover:text-white" : "cursor-default opacity-40",
                    )}
                    title={t("library.revealInFinder")}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
