import { Link, Radio, Unlink } from "lucide-react";
import { useUiPreferences } from "../application/use-ui-preferences";
import { BindingWizard } from "./binding-wizard";
import { cn } from "../lib/utils";

function formatTimestamp(value: string | null, locale: string) {
  if (!value) {
    return "n/a";
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return timestamp.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateTail(value: string | null | undefined, limit = 56) {
  const normalizedValue = `${value ?? ""}`.trim();
  if (!normalizedValue) {
    return "n/a";
  }

  return normalizedValue.length > limit
    ? `...${normalizedValue.slice(-limit)}`
    : normalizedValue;
}

function OpenClawInsightCard(props: {
  title: string;
  eyebrow?: string;
  primary: string;
  lines: string[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
        {props.eyebrow ?? "runtime"}
      </div>
      <div className="mt-2 text-sm font-medium text-white">{props.title}</div>
      <div className="mt-2 text-sm text-white/80">{props.primary}</div>
      <div className="mt-2 space-y-1">
        {props.lines.map((line) => (
          <div key={line} className="text-xs text-white/45">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

export function OpenClawSettingsSurface(props: {
  binding: SabrinaOpenClawBinding | null;
  connectionConfig: SabrinaOpenClawConnectionConfig;
  connectionState: SabrinaOpenClawConnectionState | null;
  bindingSetupState: SabrinaOpenClawBindingSetupState;
  skillCatalog: SabrinaOpenClawSkillCatalog | null;
  deviceStatus: SabrinaOpenClawDeviceStatus | null;
  gatewayStatus: SabrinaOpenClawGatewayStatus | null;
  pairingStatus: SabrinaOpenClawPairingStatus | null;
  lastError: string;
  doctorReport: SabrinaOpenClawDoctorReport | null;
  turnJournalEntries: SabrinaTurnJournalEntry[];
  turnJournalStats: SabrinaTurnJournalStats | null;
  browserMemoryRecords: SabrinaBrowserMemoryRecord[];
  browserMemoryStats: SabrinaBrowserMemoryStats | null;
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
    driver?: "local-cli" | "ssh-cli" | "relay-paired";
    sshTarget?: string;
    sshPort?: number;
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
    driver?: "local-cli" | "ssh-cli" | "relay-paired";
    sshTarget?: string;
    sshPort?: number;
    relayUrl?: string;
    connectCode?: string;
    label?: string;
    agentId?: string;
  }) => void;
  onCreateRelayConnectCode: (params?: {
    relayUrl?: string;
    ttlMs?: number;
  }) => Promise<SabrinaOpenClawRelayPairingState | null>;
  onGetRelayPairingState: (params?: {
    relayUrl?: string;
    connectCode?: string;
  }) => Promise<SabrinaOpenClawRelayPairingState | null>;
  onOpenExternalUrl: (url: string) => void;
  onSelectBindingTarget: (target: "local" | "remote") => void;
}) {
  const {
    approvingPairingRequestId,
    binding,
    connectionConfig,
    connectionState,
    bindingSetupState,
    skillCatalog,
    deviceStatus,
    gatewayStatus,
    isApprovingLatestDevice,
    lastError,
    doctorReport,
    turnJournalEntries,
    turnJournalStats,
    browserMemoryRecords,
    browserMemoryStats,
    lobsterLabel,
    lobsterStatus,
    onApproveLatestDeviceRequest,
    onApprovePairingRequest,
    onBeginBindingSetup,
    onConnectOpenClaw,
    onDisconnectOpenClaw,
    onDoctorOpenClaw,
    onCreateRelayConnectCode,
    onGetRelayPairingState,
    onOpenExternalUrl,
    onSelectBindingTarget,
    pairingStatus,
  } = props;
  const {
    preferences: { uiLocale },
    t,
  } = useUiPreferences();
  const remoteContract = connectionState?.remoteSessionContract ?? null;
  const skillSummary = skillCatalog?.summary ?? null;
  const doctorWarnings = (doctorReport?.checks ?? []).filter(
    (check) => check.status === "fail" || check.status === "warn",
  );

  return (
    <div className="surface-screen absolute inset-0 overflow-y-auto p-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-semibold text-white">{t("openclaw.title")}</h1>
        <div className="space-y-6">
          <div className="surface-panel relative overflow-hidden rounded-2xl border p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full",
                    lobsterStatus === "connected" ? "bg-white/12" : "bg-white/10",
                  )}
                >
                  {lobsterStatus === "connected" ? (
                    <Radio className="h-6 w-6 text-white" />
                  ) : (
                    <Unlink className="h-6 w-6 text-white/40" />
                  )}
                </div>
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-medium text-white">
                    {lobsterStatus === "connected" ? t("openclaw.connected") : t("openclaw.disconnected")}
                    {lobsterStatus === "connected" && (
                      <span className="flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                        {binding?.mode === "remote" ? t("sidebar.remote") : t("sidebar.local")}
                      </span>
                    )}
                  </h2>
                  <p className="mt-1 text-sm text-white/50">
                    {lobsterStatus === "connected"
                      ? t("openclaw.connectedDescription")
                      : t("openclaw.disconnectedDescription")}
                  </p>
                  <p className="mt-1 text-xs text-white/35">
                    {(lobsterStatus === "connected" && lobsterLabel) ||
                      connectionState?.transportLabel ||
                      (lobsterStatus === "connected"
                        ? "OpenClaw"
                        : t("openclaw.defaultLocalLabel"))}
                  </p>
                </div>
              </div>
              <div>
                {lobsterStatus === "connected" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => onBeginBindingSetup(bindingSetupState.target ?? "local")}
                      className="surface-button-system flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                    >
                      <Link className="h-4 w-4" />
                      {t("openclaw.recheck")}
                    </button>
                    <button
                      onClick={() => onDisconnectOpenClaw(bindingSetupState.target ?? "local")}
                      className="surface-button-system flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                    >
                      <Unlink className="h-4 w-4" />
                      {t("openclaw.disconnect")}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onBeginBindingSetup("local")}
                    className="surface-button-system flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                  >
                    <Link className="h-4 w-4" />
                    {t("openclaw.startConnect")}
                  </button>
                )}
              </div>
            </div>
          </div>

          <BindingWizard
            state={bindingSetupState}
            connectionConfig={connectionConfig}
            connectionState={connectionState}
            gatewayStatus={gatewayStatus}
            deviceStatus={deviceStatus}
            pairingStatus={pairingStatus}
            lastError={lastError}
            approvingPairingRequestId={approvingPairingRequestId}
            isApprovingLatestDevice={isApprovingLatestDevice}
            onSelectTarget={onSelectBindingTarget}
            onApprovePairingRequest={onApprovePairingRequest}
            onApproveLatestDeviceRequest={onApproveLatestDeviceRequest}
            onConnectRemote={onConnectOpenClaw}
            onDoctorRemote={onDoctorOpenClaw}
            onCreateRelayConnectCode={onCreateRelayConnectCode}
            onGetRelayPairingState={onGetRelayPairingState}
            onPrimaryAction={() => onBeginBindingSetup(bindingSetupState.target ?? "local")}
            onSecondaryAction={
              lobsterStatus === "connected"
                ? () => onDisconnectOpenClaw(bindingSetupState.target ?? "local")
                : bindingSetupState.target === "remote"
                ? () => onSelectBindingTarget("local")
                : undefined
            }
          />

          <div className="surface-panel rounded-2xl border p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-medium text-white">Runtime Contract</h2>
                <p className="text-sm text-white/45">
                  Browser truth, capability provenance, and durable turn evidence projected from the current OpenClaw runtime.
                </p>
              </div>
              <div className="text-xs text-white/35">
                {connectionState?.transportLabel ?? "local"} ·{" "}
                {remoteContract?.contractVersion
                  ? `contract v${remoteContract.contractVersion}`
                  : "contract n/a"}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <OpenClawInsightCard
                title="Remote Session"
                eyebrow="transport"
                primary={[
                  remoteContract?.transport ?? connectionConfig.transport,
                  remoteContract?.driver ?? connectionConfig.driver ?? "n/a",
                ]
                  .filter(Boolean)
                  .join(" · ")}
                lines={[
                  `features ${remoteContract?.features?.length ?? 0}`,
                  `profile ${remoteContract?.profile ?? "default"}`,
                  `agent ${remoteContract?.agentId ?? binding?.agentId ?? "n/a"}`,
                  remoteContract?.sshTarget
                    ? `ssh ${remoteContract.sshTarget}${remoteContract.sshPort ? `:${remoteContract.sshPort}` : ""}`
                    : remoteContract?.relayUrl
                      ? `relay ${truncateTail(remoteContract.relayUrl, 40)}`
                      : `state ${truncateTail(remoteContract?.stateDir ?? connectionState?.stateDir, 40)}`,
                ]}
              />

              <OpenClawInsightCard
                title="Capability Provenance"
                eyebrow="skills"
                primary={
                  skillSummary
                    ? `${skillSummary.ready}/${skillSummary.total} ready`
                    : "skill catalog unavailable"
                }
                lines={[
                  `schema v${skillSummary?.browserCapabilitySchemaVersion ?? "n/a"}`,
                  `declared ${skillSummary?.capabilitySourceCounts.declared ?? 0}`,
                  `overlay ${skillSummary?.capabilitySourceCounts.overlay ?? 0}`,
                  `heuristic ${skillSummary?.capabilitySourceCounts.heuristic ?? 0}`,
                ]}
              />

              <OpenClawInsightCard
                title="Turn Journal"
                eyebrow="turns"
                primary={
                  turnJournalStats
                    ? `${turnJournalStats.count} recorded turns`
                    : "turn journal unavailable"
                }
                lines={[
                  `latest ${turnJournalStats?.latestStatus ?? "n/a"}`,
                  `updated ${formatTimestamp(turnJournalStats?.latestCreatedAt ?? null, uiLocale)}`,
                  `blocked ${turnJournalStats?.statusCounts.blocked ?? 0} · failed ${turnJournalStats?.statusCounts.failed ?? 0}`,
                  truncateTail(turnJournalStats?.path, 40),
                ]}
              />

              <OpenClawInsightCard
                title="Browser Memory"
                eyebrow="memory"
                primary={
                  browserMemoryStats
                    ? `${browserMemoryStats.count} captured records`
                    : "memory bridge unavailable"
                }
                lines={[
                  `latest ${formatTimestamp(browserMemoryStats?.latestCapturedAt ?? null, uiLocale)}`,
                  browserMemoryRecords[0]?.title
                    ? `head ${truncateTail(browserMemoryRecords[0].title, 36)}`
                    : "head n/a",
                  browserMemoryRecords[0]?.url
                    ? truncateTail(browserMemoryRecords[0].url, 40)
                    : "url n/a",
                  truncateTail(browserMemoryStats?.path, 40),
                ]}
              />
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-white">Recent Turn Evidence</h3>
                    <p className="mt-1 text-xs text-white/45">
                      Latest runtime receipts written into Sabrina&apos;s separate turn journal.
                    </p>
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                    {turnJournalEntries.length} entries
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {turnJournalEntries.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-white/40">
                      No turn journal entries yet.
                    </div>
                  ) : (
                    turnJournalEntries.slice(0, 3).map((entry) => (
                      <div
                        key={entry.journalId}
                        className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3 text-xs text-white/45">
                          <span>{entry.turnType || "turn"}</span>
                          <span>{formatTimestamp(entry.createdAt, uiLocale)}</span>
                        </div>
                        <div className="mt-1 text-sm text-white/85">
                          {entry.summary || entry.receipt?.summary || entry.userText || "No summary"}
                        </div>
                        <div className="mt-2 text-xs text-white/45">
                          {entry.receipt?.status ?? "unknown"} · {entry.policyDecision || "no policy"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-white">Doctor Snapshot</h3>
                    <p className="mt-1 text-xs text-white/45">
                      Last explicit doctor report captured through the current binding flow.
                    </p>
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                    {doctorReport ? `${doctorReport.failureCount} fail · ${doctorReport.warningCount} warn` : "not run"}
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {!doctorReport ? (
                    <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-white/40">
                      Run a doctor action from the binding flow to capture a fresh report.
                    </div>
                  ) : doctorWarnings.length === 0 ? (
                    <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-3 py-4 text-sm text-green-300">
                      Latest doctor report passed without warnings.
                    </div>
                  ) : (
                    doctorWarnings.slice(0, 4).map((check) => (
                      <div
                        key={check.id}
                        className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm text-white/85">{check.label}</div>
                          <div
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] uppercase tracking-[0.16em]",
                              check.status === "fail"
                                ? "bg-red-500/20 text-red-300"
                                : "bg-amber-500/20 text-amber-300",
                            )}
                          >
                            {check.status}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-white/45">{check.detail}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
