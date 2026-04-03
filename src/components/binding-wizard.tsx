import { useUiPreferences } from "../application/use-ui-preferences";
import {
  BindingNextStepPanel,
  BindingRemoteStatusPanel,
  BindingRuntimeStatusPanel,
  BindingSetupStepsCard,
  BindingTargetSelector,
} from "./binding-wizard-parts";
import type { BindingWizardProps } from "./binding-wizard-types";

export function BindingWizard(props: BindingWizardProps) {
  const { state } = props;
  const showLocalRuntimeStatus = state.target !== "remote";
  const { t } = useUiPreferences();

  return (
    <section className="surface-panel flex flex-col gap-6 rounded-[28px] border p-6">
      <div className="space-y-2">
        <div className="surface-badge inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]">
          <span
            className={
              state.status === "ready"
                ? "h-1.5 w-1.5 rounded-full bg-green-400"
                : state.status === "degraded"
                  ? "h-1.5 w-1.5 rounded-full bg-amber-400"
                  : "h-1.5 w-1.5 rounded-full bg-white/35"
            }
          />
          {t("binding.badge")}
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl leading-tight font-semibold tracking-[-0.03em]">{state.title}</h2>
          <p className="max-w-2xl text-sm leading-6 text-white/58">{state.description}</p>
          {state.note ? (
            <p className="max-w-2xl text-xs leading-5 text-white/40">{state.note}</p>
          ) : null}
        </div>
      </div>

      <BindingTargetSelector
        target={state.target}
        onSelectTarget={props.onSelectTarget}
      />

      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <BindingSetupStepsCard state={state} />

        {showLocalRuntimeStatus ? (
          <BindingRuntimeStatusPanel
            connectionState={props.connectionState}
            gatewayStatus={props.gatewayStatus}
            deviceStatus={props.deviceStatus}
            pairingStatus={props.pairingStatus}
            lastError={props.lastError}
          />
        ) : (
          <BindingRemoteStatusPanel
            connectionConfig={props.connectionConfig}
            connectionState={props.connectionState}
            onConnectRemote={props.onConnectRemote}
            onDoctorRemote={props.onDoctorRemote}
          />
        )}

        <div className="xl:col-span-2">
          <BindingNextStepPanel
            state={state}
            onPrimaryAction={props.onPrimaryAction}
            onSecondaryAction={props.onSecondaryAction}
          />
        </div>
      </div>
    </section>
  );
}
