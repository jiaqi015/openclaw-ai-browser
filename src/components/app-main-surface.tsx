import type { RefObject } from "react";
import { type MainSurfaceMode } from "../application/browser-surface";
import { SkillsSurface } from "./skills-surface";
import { SurfaceRouter } from "../shell/SurfaceRouter";

type AppMainSurfaceProps = {
  surfaceMode: string;
  browserSurfaceRef: RefObject<HTMLDivElement | null>;
  activeTabUrl: string;
  desktopUnavailable: boolean;
  historyEntries: SabrinaHistoryEntry[];
  bookmarkEntries: SabrinaBookmarkEntry[];
  downloads: SabrinaDownloadEntry[];
  diagnostics: SabrinaDiagnosticsState | null;
  lobsterStatus: "connected" | "disconnected";
  lobsterLabel: string;
  binding: SabrinaOpenClawBinding | null;
  connectionState: SabrinaOpenClawConnectionState | null;
  bindingSetupState: SabrinaOpenClawBindingSetupState;
  gatewayStatus?: SabrinaOpenClawGatewayStatus | null;
  deviceStatus?: SabrinaOpenClawDeviceStatus | null;
  pairingStatus?: SabrinaOpenClawPairingStatus | null;
  lastError?: string;
  approvingPairingRequestId?: string | null;
  isApprovingLatestDevice?: boolean;
  pinnedSkillNames: string[];
  hiddenSkillNames: string[];
  skillCatalog: SabrinaOpenClawSkillCatalog | null;
  onTogglePinnedSkill: (skillName: string) => void;
  onToggleHiddenSkill: (skillName: string) => void;
  onBeginBindingSetup: (target: "local" | "remote") => void;
  onDisconnectOpenClaw: (target?: "local" | "remote") => void;
  onCloseGenTab: (genTabId: string) => void;
  onApprovePairingRequest: (
    request: SabrinaOpenClawPairingStatus["requests"][number],
  ) => void;
  onApproveLatestDeviceRequest: () => void;
  onNavigate: (url: string) => void;
  onRemoveBookmark: (url: string) => void;
  onOpenDownload: (downloadId: string) => void;
  onRevealDownload: (downloadId: string) => void;
  onRefreshDiagnostics: () => void;
  onOpenLogDirectory: () => void;
  onRevealHumanLogFile: () => void;
  onOpenDiagnostics: () => void;
  onOpenExternalUrl: (url: string) => void;
  onSelectBindingTarget: (target: "local" | "remote") => void;
};

export function AppMainSurface(props: AppMainSurfaceProps) {
  if (props.surfaceMode === "skills") {
    return (
      <SkillsSurface
        pinnedSkillNames={props.pinnedSkillNames}
        hiddenSkillNames={props.hiddenSkillNames}
        skillCatalog={props.skillCatalog}
        onTogglePinnedSkill={props.onTogglePinnedSkill}
        onToggleHiddenSkill={props.onToggleHiddenSkill}
      />
    );
  }

  return (
    <SurfaceRouter
      surfaceMode={props.surfaceMode as MainSurfaceMode}
      browserSurfaceRef={props.browserSurfaceRef}
      currentUrl={props.activeTabUrl}
      desktopUnavailable={props.desktopUnavailable}
      historyEntries={props.historyEntries}
      bookmarkEntries={props.bookmarkEntries}
      downloads={props.downloads}
      diagnostics={props.diagnostics}
      lobsterStatus={props.lobsterStatus}
      lobsterLabel={props.lobsterLabel}
      binding={props.binding}
      connectionState={props.connectionState}
      bindingSetupState={props.bindingSetupState}
      gatewayStatus={props.gatewayStatus}
      deviceStatus={props.deviceStatus}
      pairingStatus={props.pairingStatus}
      lastError={props.lastError}
      approvingPairingRequestId={props.approvingPairingRequestId}
      isApprovingLatestDevice={props.isApprovingLatestDevice}
      onBeginBindingSetup={props.onBeginBindingSetup}
      onDisconnectOpenClaw={props.onDisconnectOpenClaw}
      onCloseGenTab={props.onCloseGenTab}
      onApprovePairingRequest={props.onApprovePairingRequest}
      onApproveLatestDeviceRequest={props.onApproveLatestDeviceRequest}
      onNavigate={props.onNavigate}
      onRemoveBookmark={props.onRemoveBookmark}
      onOpenDownload={props.onOpenDownload}
      onRevealDownload={props.onRevealDownload}
      onRefreshDiagnostics={props.onRefreshDiagnostics}
      onOpenLogDirectory={props.onOpenLogDirectory}
      onRevealHumanLogFile={props.onRevealHumanLogFile}
      onOpenDiagnostics={props.onOpenDiagnostics}
      onOpenExternalUrl={props.onOpenExternalUrl}
      onSelectBindingTarget={props.onSelectBindingTarget}
    />
  );
}
