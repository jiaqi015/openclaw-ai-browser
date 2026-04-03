import type { ReactNode } from "react";
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
import { cn } from "../lib/utils";
import type { BindingWizardProps } from "./binding-wizard-types";

const targetCopy: Record<
  SabrinaBindingTarget,
  {
    title: string;
    description: string;
    icon: typeof MonitorSmartphone;
    available: boolean;
  }
> = {
  local: {
    title: "本机",
    description: "适合这台机器上已经装好 OpenClaw。",
    icon: MonitorSmartphone,
    available: true,
  },
  remote: {
    title: "远程",
    description: "远程连接稍后开放。",
    icon: ServerCog,
    available: false,
  },
};

export function BindingTargetSelector({
  target,
  onSelectTarget,
}: Pick<BindingWizardProps, "onSelectTarget"> & {
  target: SabrinaBindingTarget;
}) {
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
                      预留
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
  return (
    <div className="surface-panel self-start rounded-[24px] border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/72">
          步骤
        </h3>
        {state.status === "bootstrapping" || state.status === "pairing" ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-white/42">
            <Loader2 className="h-3 w-3 animate-spin" />
            处理中
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
      ? "已连接"
      : connectionState?.status === "connecting"
        ? "连接中"
        : connectionState?.status === "attention"
          ? "需要处理"
          : "未连接";
  const connectionDetail =
    connectionState?.status === "connected"
      ? connectionState?.detail || "浏览器代理已就绪。"
      : "接入后可直接复用当前 OpenClaw。";
  const gatewayDetail = gatewayStatus
    ? `${gatewayStatus.serviceStatus || "unknown"} · ${gatewayStatus.sessionCount} 会话`
    : "还没有拿到网关状态";
  const controlDetail =
    pairingCount > 0 || pendingDeviceCount > 0 || pairedDeviceCount > 0
      ? `${pairedDeviceCount} 已配对 · ${pendingDeviceCount} 待处理`
      : "当前没有待处理请求";

  return (
    <div className="surface-panel self-start rounded-[24px] border p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-white/72">
            当前状态
          </h3>
          <p className="mt-2 text-sm leading-6 text-white/56">
            这里只看接入结果。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <StatusCard
          icon={<Shield className="h-4 w-4" />}
          label="连接"
          value={connectionValue}
          detail={connectionDetail}
          tone={connectionTone}
        />
        <StatusCard
          icon={<Link2 className="h-4 w-4" />}
          label="网关"
          value={gatewayStatus?.ok ? "已连通" : "待检查"}
          detail={gatewayDetail}
          tone={gatewayStatus?.ok ? "good" : "muted"}
        />
        <StatusCard
          icon={<MonitorSmartphone className="h-4 w-4" />}
          label="目标"
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
              <p className="text-sm font-medium text-amber-100">提醒</p>
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
          OpenClaw 里还有通用配对或设备请求，需要时再去 doctor 里看。
        </p>
      ) : null}

      {lastError ? (
        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3.5">
          <p className="text-sm font-medium text-rose-100">最近一次失败</p>
          <p className="mt-1 text-[12px] leading-5 text-rose-100/80">{lastError}</p>
        </div>
      ) : null}
    </div>
  );
}

export function BindingRemoteStatusPanel() {
  return (
    <div className="surface-panel self-start rounded-[24px] border p-5">
      <h3 className="text-sm font-medium text-white/72">
        远程连接
      </h3>
      <p className="mt-3 text-sm leading-6 text-white/58">
        远程连接还没开放。
      </p>
      <p className="mt-2 text-[12px] leading-5 text-white/42">
        先用本机连接就行。
      </p>
    </div>
  );
}

export function BindingNextStepPanel({
  state,
  onPrimaryAction,
  onSecondaryAction,
}: Pick<BindingWizardProps, "state" | "onPrimaryAction" | "onSecondaryAction">) {
  return (
    <div className="surface-panel flex flex-col gap-4 rounded-[24px] border p-5 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-white/72">
          操作
        </h3>
        <p className="text-sm leading-6 text-white/58">
          连接后直接复用当前 OpenClaw。
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
