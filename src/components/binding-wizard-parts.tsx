import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Link2,
  Loader2,
  MonitorSmartphone,
  ServerCog,
  Shield,
} from "lucide-react";
import type { SabrinaBindingTarget } from "../application/sabrina-openclaw";
import { useUiPreferences } from "../application/use-ui-preferences";
import { cn } from "../lib/utils";
import type { BindingWizardProps } from "./binding-wizard-types";

function getTargetCopy(
  t: (key: string, params?: Record<string, unknown>) => string,
): Record<
  SabrinaBindingTarget,
  {
    title: string;
    description: string;
    icon: typeof MonitorSmartphone;
    available: boolean;
  }
> {
  return {
    local: {
      title: t("binding.target.local.title"),
      description: t("binding.target.local.description"),
      icon: MonitorSmartphone,
      available: true,
    },
    remote: {
      title: t("binding.target.remote.title"),
      description: t("binding.target.remote.description"),
      icon: ServerCog,
      available: true,
    },
  };
}

export function BindingTargetSelector({
  target,
  onSelectTarget,
}: Pick<BindingWizardProps, "onSelectTarget"> & {
  target: SabrinaBindingTarget;
}) {
  const { t } = useUiPreferences();
  const targetCopy = getTargetCopy(t);
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {(["local", "remote"] as const).map((candidate) => {
        const copy = targetCopy[candidate];
        const Icon = copy.icon;
        const selected = target === candidate;
        const isAvailable = copy.available;
        return (
          <button
            key={candidate}
            type="button"
            disabled={!isAvailable}
            onClick={() => onSelectTarget?.(candidate)}
            className={cn(
              "surface-card-selectable group rounded-[24px] border p-4 text-left transition-colors",
              selected && "surface-card-selectable-active",
              !isAvailable && "cursor-not-allowed opacity-60",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="rounded-2xl bg-white/8 p-2 text-white/70">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-white/88">{copy.title}</span>
                  {!isAvailable ? (
                    <span className="rounded-full border border-white/12 bg-white/6 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/48">
                      {t("binding.target.reserved")}
                    </span>
                  ) : null}
                </div>
                <p className="text-[12px] leading-5 text-white/48">{copy.description}</p>
              </div>
              {selected ? (
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-green-400" />
              ) : (
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-white/24 transition-transform group-hover:translate-x-0.5" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function BindingSetupStepsCard({
  state,
}: Pick<BindingWizardProps, "state">) {
  const { t } = useUiPreferences();
  return (
    <div className="surface-panel self-start rounded-[24px] border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/72">
          {t("binding.steps")}
        </h3>
        {state.status === "bootstrapping" || state.status === "pairing" ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-white/42">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("binding.processing")}
          </span>
        ) : null}
      </div>
      <div className="space-y-3">
        {state.steps.map((step, index) => (
          <div key={step.id} className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                step.status === "completed"
                  ? "bg-green-500/18 text-green-300"
                  : step.status === "error"
                    ? "bg-rose-500/18 text-rose-300"
                    : step.status === "in_progress"
                      ? "bg-white/14 text-white"
                      : "bg-white/6 text-white/40",
              )}
            >
              {step.status === "completed" ? "✓" : index + 1}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-white/86">{step.title}</p>
              <p className="text-[12px] leading-5 text-white/46">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BindingRuntimeStatusPanel({
  connectionState,
  gatewayStatus,
  deviceStatus,
  pairingStatus,
  lastError,
}: Pick<
  BindingWizardProps,
  | "connectionState"
  | "gatewayStatus"
  | "deviceStatus"
  | "pairingStatus"
  | "lastError"
>) {
  const { t } = useUiPreferences();
  const visibleWarnings = gatewayStatus?.warnings?.filter(Boolean) ?? [];
  const pairingCount = pairingStatus?.requestCount ?? 0;
  const pairedDeviceCount = deviceStatus?.pairedCount ?? 0;
  const pendingDeviceCount = deviceStatus?.pendingCount ?? 0;
  const connectionTone =
    connectionState?.status === "connected"
      ? "good"
      : connectionState?.status === "attention"
        ? "warn"
        : "muted";
  const connectionValue =
    connectionState?.status === "connected"
      ? t("binding.connection.connected")
      : connectionState?.status === "connecting"
        ? t("binding.connection.connecting")
        : connectionState?.status === "attention"
          ? t("binding.connection.attention")
          : t("binding.connection.disconnected");
  const connectionDetail =
    connectionState?.status === "connected"
      ? connectionState?.detail || t("binding.connection.agentReady")
      : t("binding.connection.reuse");
  const gatewayDetail = gatewayStatus
    ? t("binding.gatewaySessions", {
        status: gatewayStatus.serviceStatus || "unknown",
        count: gatewayStatus.sessionCount,
      })
    : t("binding.gatewayUnknown");
  const controlDetail =
    pairingCount > 0 || pendingDeviceCount > 0 || pairedDeviceCount > 0
      ? t("binding.deviceRequests", {
          paired: pairedDeviceCount,
          pending: pendingDeviceCount,
        })
      : t("binding.noPendingRequests");

  return (
    <div className="surface-panel self-start rounded-[24px] border p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-white/72">
            {t("binding.statusTitle")}
          </h3>
          <p className="mt-2 text-sm leading-6 text-white/56">
            {t("binding.statusDescription")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <StatusCard
          icon={<Shield className="h-4 w-4" />}
          label={t("binding.label.connection")}
          value={connectionValue}
          detail={connectionDetail}
          tone={connectionTone}
        />
        <StatusCard
          icon={<Link2 className="h-4 w-4" />}
          label={t("binding.label.gateway")}
          value={gatewayStatus?.ok ? t("binding.gatewayConnected") : t("binding.gatewayPending")}
          detail={gatewayDetail}
          tone={gatewayStatus?.ok ? "good" : "muted"}
        />
        <StatusCard
          icon={<MonitorSmartphone className="h-4 w-4" />}
          label={t("binding.label.target")}
          value={connectionState?.transportLabel || "default"}
          detail={controlDetail}
          tone={pairingCount > 0 || pendingDeviceCount > 0 ? "warn" : "muted"}
        />
      </div>

      {visibleWarnings.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3.5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-100">{t("binding.warning")}</p>
              {visibleWarnings.slice(0, 3).map((warning) => (
                <p key={warning} className="text-[12px] leading-5 text-amber-100/80">
                  {warning}
                </p>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {pairingCount > 0 || pendingDeviceCount > 0 ? (
        <p className="mt-4 text-[12px] leading-5 text-white/42">
          {t("binding.pendingDoctorNote")}
        </p>
      ) : null}

      {lastError ? (
        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3.5">
          <p className="text-sm font-medium text-rose-100">{t("binding.lastFailure")}</p>
          <p className="mt-1 text-[12px] leading-5 text-rose-100/80">{lastError}</p>
        </div>
      ) : null}
    </div>
  );
}

export function BindingRemoteStatusPanel({
  connectionConfig,
  connectionState,
  onConnectRemote,
  onDoctorRemote,
}: Pick<BindingWizardProps, "connectionConfig" | "connectionState" | "onConnectRemote" | "onDoctorRemote">) {
  const { t } = useUiPreferences();
  const [driver, setDriver] = useState<"ssh-cli" | "relay-paired">("ssh-cli");
  const [sshTarget, setSshTarget] = useState("");
  const [sshPort, setSshPort] = useState("");
  const [relayUrl, setRelayUrl] = useState("");
  const [connectCode, setConnectCode] = useState("");
  const [label, setLabel] = useState("");
  const [agentId, setAgentId] = useState("");

  useEffect(() => {
    if (connectionConfig?.transport !== "remote") {
      return;
    }

    setDriver(
      connectionConfig.driver === "relay-paired" ? "relay-paired" : "ssh-cli",
    );
    setSshTarget(connectionConfig.sshTarget ?? "");
    setSshPort(
      typeof connectionConfig.sshPort === "number" && Number.isFinite(connectionConfig.sshPort)
        ? `${connectionConfig.sshPort}`
        : "",
    );
    setRelayUrl(connectionConfig.relayUrl ?? "");
    setConnectCode(connectionConfig.connectCode ?? "");
    setLabel(connectionConfig.label ?? "");
    setAgentId(connectionConfig.agentId ?? "");
  }, [
    connectionConfig?.agentId,
    connectionConfig?.connectCode,
    connectionConfig?.driver,
    connectionConfig?.label,
    connectionConfig?.relayUrl,
    connectionConfig?.sshPort,
    connectionConfig?.sshTarget,
    connectionConfig?.transport,
  ]);

  function buildRemotePayload() {
    return {
      target: "remote" as const,
      driver,
      sshTarget: sshTarget.trim() || undefined,
      sshPort: sshPort.trim() ? Number(sshPort.trim()) : undefined,
      relayUrl: relayUrl.trim() || undefined,
      connectCode: connectCode.trim() || undefined,
      label: label.trim() || undefined,
      agentId: agentId.trim() || undefined,
    };
  }

  return (
    <div className="surface-panel self-start rounded-[24px] border p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-white/72">
          {t("binding.remoteTitle")}
        </h3>
        <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-amber-200">
          {t("binding.remote.experimental")}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/58">
        {t("binding.remoteDescription")}
      </p>
      <p className="mt-2 text-[12px] leading-5 text-white/42">
        {t("binding.remoteNote")}
      </p>

      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/38">
            {t("binding.remote.driver")}
          </label>
          <select
            value={driver}
            onChange={(event) => setDriver(event.target.value as "ssh-cli" | "relay-paired")}
            className="surface-input h-11 w-full rounded-2xl border px-3 text-sm text-white/80 outline-none"
          >
            <option value="ssh-cli">ssh-cli</option>
            <option value="relay-paired">
              relay-paired
            </option>
          </select>
        </div>

        {driver === "ssh-cli" ? (
          <>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/38">
                {t("binding.remote.sshTarget")}
              </label>
              <input
                value={sshTarget}
                onChange={(event) => setSshTarget(event.target.value)}
                placeholder={t("binding.remote.sshPlaceholder")}
                className="surface-input h-11 w-full rounded-2xl border px-3 text-sm text-white/80 outline-none placeholder:text-white/25"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/38">
                  {t("binding.remote.sshPort")}
                </label>
                <input
                  value={sshPort}
                  onChange={(event) => setSshPort(event.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder="22"
                  className="surface-input h-11 w-full rounded-2xl border px-3 text-sm text-white/80 outline-none placeholder:text-white/25"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/38">
                  {t("binding.remote.agent")}
                </label>
                <input
                  value={agentId}
                  onChange={(event) => setAgentId(event.target.value)}
                  placeholder={t("binding.remote.agentPlaceholder")}
                  className="surface-input h-11 w-full rounded-2xl border px-3 text-sm text-white/80 outline-none placeholder:text-white/25"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/38">
                {t("binding.remote.relayUrl")}
              </label>
              <input
                value={relayUrl}
                onChange={(event) => setRelayUrl(event.target.value)}
                placeholder={t("binding.remote.relayPlaceholder")}
                className="surface-input h-11 w-full rounded-2xl border px-3 text-sm text-white/80 outline-none placeholder:text-white/25"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/38">
                  {t("binding.remote.connectCode")}
                </label>
                <input
                  value={connectCode}
                  onChange={(event) => setConnectCode(event.target.value.toUpperCase())}
                  placeholder={t("binding.remote.connectCodePlaceholder")}
                  className="surface-input h-11 w-full rounded-2xl border px-3 text-sm uppercase tracking-[0.16em] text-white/80 outline-none placeholder:text-white/25"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/38">
                  {t("binding.remote.agent")}
                </label>
                <input
                  value={agentId}
                  onChange={(event) => setAgentId(event.target.value)}
                  placeholder={t("binding.remote.agentPlaceholder")}
                  className="surface-input h-11 w-full rounded-2xl border px-3 text-sm text-white/80 outline-none placeholder:text-white/25"
                />
              </div>
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/38">
            {t("binding.remote.label")}
          </label>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t("binding.remote.labelPlaceholder")}
            className="surface-input h-11 w-full rounded-2xl border px-3 text-sm text-white/80 outline-none placeholder:text-white/25"
          />
        </div>

        {driver === "relay-paired" ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3.5">
            <p className="text-[12px] leading-5 text-amber-100/85">
              {t("binding.remote.relayPending")}
            </p>
          </div>
        ) : null}

      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onConnectRemote?.(buildRemotePayload())}
          className="surface-button-system rounded-2xl border px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          {t("binding.remote.connectAction")}
        </button>
        <button
          type="button"
          onClick={() => onDoctorRemote?.(buildRemotePayload())}
          className="surface-button-system rounded-2xl border px-4 py-2 text-sm font-medium text-white/72 transition-colors"
        >
          {t("binding.remote.doctorAction")}
        </button>
      </div>

      <p className="mt-3 text-[12px] leading-5 text-white/42">
        {t("binding.remote.formHint")}
      </p>

      {connectionState?.detail ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3.5">
          <p className="text-[12px] leading-5 text-white/58">{connectionState.detail}</p>
        </div>
      ) : null}
    </div>
  );
}

export function BindingNextStepPanel({
  state,
  onPrimaryAction,
  onSecondaryAction,
}: Pick<BindingWizardProps, "state" | "onPrimaryAction" | "onSecondaryAction">) {
  const { t } = useUiPreferences();
  return (
    <div className="surface-panel flex flex-col gap-4 rounded-[24px] border p-5 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-white/72">
          {t("binding.actionsTitle")}
        </h3>
        <p className="text-sm leading-6 text-white/58">
          {t("binding.actionsDescription")}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {state.primaryActionLabel && onPrimaryAction ? (
          <button
            type="button"
            onClick={onPrimaryAction}
            className="surface-button-system rounded-2xl border px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            {state.primaryActionLabel}
          </button>
        ) : null}
        {state.secondaryActionLabel && onSecondaryAction ? (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="surface-button-system rounded-2xl border px-4 py-2 text-sm font-medium text-white/72 transition-colors"
          >
            {state.secondaryActionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StatusCard(props: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "good" | "warn" | "muted";
}) {
  const toneClassName =
    props.tone === "good"
      ? "border-green-400/20 bg-green-500/10 text-green-100"
      : props.tone === "warn"
        ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
        : "border-white/8 bg-white/[0.03] text-white/78";

  return (
    <div className={cn("rounded-2xl border p-3.5", toneClassName)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 opacity-80">{props.icon}</div>
        <div className="min-w-0">
          <p className="text-[12px] font-medium">{props.label}</p>
          <p className="mt-1 text-base font-semibold leading-6">{props.value}</p>
          <p className="mt-1 text-[12px] leading-5 opacity-70">{props.detail}</p>
        </div>
      </div>
    </div>
  );
}
