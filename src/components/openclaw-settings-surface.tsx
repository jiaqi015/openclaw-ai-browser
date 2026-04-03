import { Link, Radio, Unlink } from "lucide-react";
import { BindingWizard } from "./binding-wizard";
import { cn } from "../lib/utils";

export function OpenClawSettingsSurface(props: {
  binding: SabrinaOpenClawBinding | null;
  connectionState: SabrinaOpenClawConnectionState | null;
  bindingSetupState: SabrinaOpenClawBindingSetupState;
  deviceStatus: SabrinaOpenClawDeviceStatus | null;
  gatewayStatus: SabrinaOpenClawGatewayStatus | null;
  pairingStatus: SabrinaOpenClawPairingStatus | null;
  lastError: string;
  lobsterLabel: string;
  lobsterStatus: "connected" | "disconnected";
  approvingPairingRequestId: string | null;
  isApprovingLatestDevice: boolean;
  onApproveLatestDeviceRequest: () => void;
  onApprovePairingRequest: (
    request: SabrinaOpenClawPairingStatus["requests"][number],
  ) => void;
  onBeginBindingSetup: (target?: "local" | "remote") => void;
  onDisconnectOpenClaw: (target?: "local" | "remote") => void;
  onOpenExternalUrl: (url: string) => void;
  onSelectBindingTarget: (target: "local" | "remote") => void;
}) {
  const {
    approvingPairingRequestId,
    binding,
    connectionState,
    bindingSetupState,
    deviceStatus,
    gatewayStatus,
    isApprovingLatestDevice,
    lastError,
    lobsterLabel,
    lobsterStatus,
    onApproveLatestDeviceRequest,
    onApprovePairingRequest,
    onBeginBindingSetup,
    onDisconnectOpenClaw,
    onOpenExternalUrl,
    onSelectBindingTarget,
    pairingStatus,
  } = props;

  return (
    <div className="surface-screen absolute inset-0 overflow-y-auto p-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-semibold text-white">OpenClaw</h1>
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
                    {lobsterStatus === "connected" ? "已接入" : "未接入"}
                    {lobsterStatus === "connected" && (
                      <span className="flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                        {binding?.mode === "remote" ? "远程" : "本机"}
                      </span>
                    )}
                  </h2>
                  <p className="mt-1 text-sm text-white/50">
                    {lobsterStatus === "connected"
                      ? "当前浏览器会复用这个 OpenClaw。"
                      : "接入后可直接复用模型、技能和记忆。"}
                  </p>
                  <p className="mt-1 text-xs text-white/35">
                    {(lobsterStatus === "connected" && lobsterLabel) ||
                      connectionState?.transportLabel ||
                      (lobsterStatus === "connected"
                        ? "OpenClaw"
                        : "本机 OpenClaw")}
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
                      重新检查
                    </button>
                    <button
                      onClick={() => onDisconnectOpenClaw(bindingSetupState.target ?? "local")}
                      className="surface-button-system flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                    >
                      <Unlink className="h-4 w-4" />
                      断开
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onBeginBindingSetup("local")}
                    className="surface-button-system flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                  >
                    <Link className="h-4 w-4" />
                    开始连接
                  </button>
                )}
              </div>
            </div>
          </div>

          <BindingWizard
            state={bindingSetupState}
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
            onPrimaryAction={() => onBeginBindingSetup(bindingSetupState.target ?? "local")}
            onSecondaryAction={
              lobsterStatus === "connected"
                ? () => onDisconnectOpenClaw(bindingSetupState.target ?? "local")
                : bindingSetupState.target === "remote"
                ? () => onSelectBindingTarget("local")
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
