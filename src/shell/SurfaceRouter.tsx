import type { RefObject } from "react";
import type { MainSurfaceMode } from "../application/browser-surface";
import { BrowserLibrarySurface } from "../components/browser-library-surface";
import { DiagnosticsSurface } from "../components/diagnostics-surface";
import { GeneralSettingsSurface } from "../components/general-settings-surface";
import { GenTabSurface } from "../components/gentab-surface";
import { OpenClawSettingsSurface } from "../components/openclaw-settings-surface";
import { CodingGenTabSurface } from "../components/coding-gentab-surface";
import { PulseSurface } from "../components/pulse-surface";
import { parseGenTabIdFromUrl } from "../lib/gentab-url";
import { buildMockGpuPulse } from "../lib/pulse-mock";

export function SurfaceRouter(props: {
  binding: SabrinaOpenClawBinding | null;
  connectionConfig: SabrinaOpenClawConnectionConfig;
  connectionState: SabrinaOpenClawConnectionState | null;
  bindingSetupState: SabrinaOpenClawBindingSetupState;
  bookmarkEntries: SabrinaBookmarkEntry[];
  browserSurfaceRef: RefObject<HTMLDivElement | null>;
  currentUrl: string;
  desktopUnavailable: boolean;
  diagnostics: SabrinaDiagnosticsState | null;
  downloads: SabrinaDownloadEntry[];
  deviceStatus: SabrinaOpenClawDeviceStatus | null;
  gatewayStatus: SabrinaOpenClawGatewayStatus | null;
  historyEntries: SabrinaHistoryEntry[];
  lastError: string;
  skillCatalog: SabrinaOpenClawSkillCatalog | null;
  doctorReport: SabrinaOpenClawDoctorReport | null;
  connectionProbe: SabrinaOpenClawConnectionProbeResult | null;
  turnJournalEntries: SabrinaTurnJournalEntry[];
  turnJournalStats: SabrinaTurnJournalStats | null;
  browserMemoryRecords: SabrinaBrowserMemoryRecord[];
  browserMemoryStats: SabrinaBrowserMemoryStats | null;
  savedConnections: SabrinaOpenClawSavedConnection[];
  activeConnectionId: string | null;
  lobsterLabel: string;
  lobsterStatus: "connected" | "disconnected";
  approvingPairingRequestId: string | null;
  isApprovingLatestDevice: boolean;
  onApproveLatestDeviceRequest: () => void;
  onApprovePairingRequest: (
    request: SabrinaOpenClawPairingStatus["requests"][number],
  ) => void;
  onBeginBindingSetup: (target?: "local" | "remote") => void;
  onConnectOpenClaw: (params?: {
    target?: "local" | "remote";
    profile?: string;
    stateDir?: string;
    driver?: "local-cli" | "ssh-cli" | "relay-paired" | "endpoint";
    sshTarget?: string;
    sshPort?: number;
    endpointUrl?: string;
    accessToken?: string;
    relayUrl?: string;
    connectCode?: string;
    label?: string;
    agentId?: string;
  }) => void;
  onDisconnectOpenClaw: (target?: "local" | "remote") => void;
  onDoctorOpenClaw: (params?: {
    target?: "local" | "remote";
    profile?: string;
    stateDir?: string;
    driver?: "local-cli" | "ssh-cli" | "relay-paired" | "endpoint";
    sshTarget?: string;
    sshPort?: number;
    endpointUrl?: string;
    accessToken?: string;
    relayUrl?: string;
    connectCode?: string;
    label?: string;
    agentId?: string;
  }) => void;
  onProbeConnection: (params?: {
    target?: "local" | "remote";
    profile?: string;
    stateDir?: string;
    driver?: "local-cli" | "ssh-cli" | "relay-paired" | "endpoint";
    sshTarget?: string;
    sshPort?: number;
    endpointUrl?: string;
    accessToken?: string;
    relayUrl?: string;
    connectCode?: string;
    label?: string;
    agentId?: string;
  }) => Promise<SabrinaOpenClawConnectionProbeResult | null> | SabrinaOpenClawConnectionProbeResult | null;
  onCreateRelayConnectCode: (params?: {
    relayUrl?: string;
    ttlMs?: number;
  }) => Promise<SabrinaOpenClawRelayPairingState | null>;
  onGetRelayPairingState: (params?: {
    relayUrl?: string;
    connectCode?: string;
  }) => Promise<SabrinaOpenClawRelayPairingState | null>;
  onSaveConnectionPreset: (params?: {
    id?: string;
    name?: string;
    target?: "local" | "remote";
    profile?: string;
    stateDir?: string;
    driver?: "local-cli" | "ssh-cli" | "relay-paired" | "endpoint";
    sshTarget?: string;
    sshPort?: number;
    endpointUrl?: string;
    accessToken?: string;
    relayUrl?: string;
    connectCode?: string;
    label?: string;
    agentId?: string;
    markActive?: boolean;
  }) => Promise<SabrinaOpenClawState | null> | SabrinaOpenClawState | null;
  onSelectSavedConnection: (savedConnectionId: string) => Promise<SabrinaOpenClawState | null> | SabrinaOpenClawState | null;
  onConnectSavedConnection: (savedConnectionId: string) => Promise<SabrinaOpenClawState | null> | SabrinaOpenClawState | null;
  onRemoveSavedConnection: (savedConnectionId: string) => Promise<SabrinaOpenClawState | null> | SabrinaOpenClawState | null;
  onCloseGenTab: (genTabId: string) => void;
  onNavigate: (url: string) => void;
  onOpenDiagnostics: () => void;
  onOpenDownload: (downloadId: string) => void;
  onOpenExternalUrl: (url: string) => void;
  onOpenLogDirectory: () => void;
  onRefreshDiagnostics: () => void;
  onRemoveBookmark: (url: string) => void;
  onRevealDownload: (downloadId: string) => void;
  onRevealHumanLogFile: () => void;
  onSelectBindingTarget: (target: "local" | "remote") => void;
  pairingStatus: SabrinaOpenClawPairingStatus | null;
  surfaceMode: MainSurfaceMode;
}) {
  const {
    binding,
    connectionConfig,
    connectionState,
    bindingSetupState,
    bookmarkEntries,
    browserSurfaceRef,
    currentUrl,
    desktopUnavailable,
    diagnostics,
    downloads,
    deviceStatus,
    gatewayStatus,
    historyEntries,
    lastError,
    skillCatalog,
    doctorReport,
    connectionProbe,
    turnJournalEntries,
    turnJournalStats,
    browserMemoryRecords,
    browserMemoryStats,
    savedConnections,
    activeConnectionId,
    lobsterLabel,
    lobsterStatus,
    approvingPairingRequestId,
    isApprovingLatestDevice,
    onApproveLatestDeviceRequest,
    onApprovePairingRequest,
    onBeginBindingSetup,
    onConnectOpenClaw,
    onDisconnectOpenClaw,
    onDoctorOpenClaw,
    onProbeConnection,
    onCreateRelayConnectCode,
    onGetRelayPairingState,
    onSaveConnectionPreset,
    onSelectSavedConnection,
    onConnectSavedConnection,
    onRemoveSavedConnection,
    onCloseGenTab,
    onNavigate,
    onOpenDiagnostics,
    onOpenDownload,
    onOpenExternalUrl,
    onOpenLogDirectory,
    onRefreshDiagnostics,
    onRemoveBookmark,
    onRevealDownload,
    onRevealHumanLogFile,
    onSelectBindingTarget,
    pairingStatus,
    surfaceMode,
  } = props;

  const genTabId = parseGenTabIdFromUrl(currentUrl);
  if (genTabId !== null) {
    // Coding GenTab: URL has ?v=coding query param OR the pending metadata
    // will identify it. The CodingGenTabSurface handles both states (loading
    // theatre and done iframe). Legacy GenTabSurface stays for non-coding tabs.
    const isCoding = /[?&]v=coding\b/.test(currentUrl);
    if (isCoding) {
      return (
        <CodingGenTabSurface
          url={currentUrl}
          onCloseGenTab={onCloseGenTab}
        />
      );
    }

    // Pulse demo flag (kept for design iteration)
    const isPulse = /[?&]pulse=1\b/.test(currentUrl) || genTabId.startsWith("pulse-demo");
    if (isPulse) {
      return (
        <PulseSurface
          pulse={buildMockGpuPulse()}
          onClose={() => onCloseGenTab(genTabId)}
        />
      );
    }

    return <GenTabSurface url={currentUrl} onCloseGenTab={onCloseGenTab} />;
  }

  if (
    surfaceMode === "history" ||
    surfaceMode === "bookmarks" ||
    surfaceMode === "downloads"
  ) {
    return (
      <BrowserLibrarySurface
        mode={surfaceMode}
        historyEntries={historyEntries}
        bookmarkEntries={bookmarkEntries}
        downloads={downloads}
        onNavigate={onNavigate}
        onRemoveBookmark={onRemoveBookmark}
        onOpenDownload={onOpenDownload}
        onRevealDownload={onRevealDownload}
      />
    );
  }

  if (surfaceMode === "diagnostics") {
    return (
      <DiagnosticsSurface
        state={diagnostics}
        connectionState={connectionState}
        skillCatalog={skillCatalog}
        doctorReport={doctorReport}
        turnJournalStats={turnJournalStats}
        browserMemoryStats={browserMemoryStats}
        onRefresh={onRefreshDiagnostics}
        onOpenLogDirectory={onOpenLogDirectory}
        onRevealHumanLogFile={onRevealHumanLogFile}
      />
    );
  }

  if (surfaceMode === "general-settings") {
    return <GeneralSettingsSurface onOpenDiagnostics={onOpenDiagnostics} />;
  }

  if (surfaceMode === "settings") {
    return (
      <OpenClawSettingsSurface
        binding={binding}
        connectionConfig={connectionConfig}
        connectionState={connectionState}
        bindingSetupState={bindingSetupState}
        skillCatalog={skillCatalog}
        gatewayStatus={gatewayStatus}
        deviceStatus={deviceStatus}
        pairingStatus={pairingStatus}
        lastError={lastError}
        doctorReport={doctorReport}
        connectionProbe={connectionProbe}
        turnJournalEntries={turnJournalEntries}
        turnJournalStats={turnJournalStats}
        browserMemoryRecords={browserMemoryRecords}
        browserMemoryStats={browserMemoryStats}
        savedConnections={savedConnections}
        activeConnectionId={activeConnectionId}
        lobsterStatus={lobsterStatus}
        lobsterLabel={lobsterLabel}
        approvingPairingRequestId={approvingPairingRequestId}
        isApprovingLatestDevice={isApprovingLatestDevice}
        onBeginBindingSetup={onBeginBindingSetup}
        onConnectOpenClaw={onConnectOpenClaw}
        onDisconnectOpenClaw={onDisconnectOpenClaw}
        onDoctorOpenClaw={onDoctorOpenClaw}
        onProbeConnection={onProbeConnection}
        onCreateRelayConnectCode={onCreateRelayConnectCode}
        onGetRelayPairingState={onGetRelayPairingState}
        onSaveConnectionPreset={onSaveConnectionPreset}
        onSelectSavedConnection={onSelectSavedConnection}
        onConnectSavedConnection={onConnectSavedConnection}
        onRemoveSavedConnection={onRemoveSavedConnection}
        onOpenExternalUrl={onOpenExternalUrl}
        onSelectBindingTarget={onSelectBindingTarget}
        onApprovePairingRequest={onApprovePairingRequest}
        onApproveLatestDeviceRequest={onApproveLatestDeviceRequest}
      />
    );
  }

  return (
    <>
      <div className="surface-screen absolute inset-0" />
      <div ref={browserSurfaceRef} className="absolute inset-0 bg-white" />
      {desktopUnavailable && (
        <div className="surface-screen absolute inset-0 flex items-center justify-center">
          <div className="surface-panel rounded-2xl border px-6 py-5 text-center">
            <p className="text-sm font-medium text-white">当前不是 Electron 环境</p>
            <p className="mt-2 text-xs text-white/50">请通过 Electron 启动，这里才会挂载真实网页内容。</p>
          </div>
        </div>
      )}
    </>
  );
}
