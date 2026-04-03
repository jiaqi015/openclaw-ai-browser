import {
  buildLocalOpenClawBinding,
  getBindingSetupState,
  getLocalDeviceStatus,
  getLocalGatewayStatus,
  getLocalModelState,
  getLocalPairingStatus,
  getLocalSkillCatalog,
} from "./OpenClawManager.mjs";
import { probeOpenClawTransport } from "./OpenClawClient.mjs";
import {
  createConnectionState,
  normalizeConnectionConfig,
  createDefaultBindingSetupState,
  createDefaultOpenClawState,
  normalizeTarget,
} from "./OpenClawStateModel.mjs";
import { setOpenClawTransportContext } from "./OpenClawTransportContext.mjs";

export async function buildRefreshedOpenClawState(currentState = {}, options = {}) {
  const selectedTarget = normalizeTarget(options?.target ?? currentState?.selectedTarget);
  const connectionConfig = normalizeConnectionConfig(
    {
      ...currentState?.connectionConfig,
      ...options?.connectionConfig,
      transport: selectedTarget,
    },
    selectedTarget,
  );
  setOpenClawTransportContext(connectionConfig);
  const nextState = {
    ...createDefaultOpenClawState(),
    selectedTarget,
    connectionConfig,
    bindingSetupState: createDefaultBindingSetupState(selectedTarget),
    lastRefreshedAt: new Date().toISOString(),
    lastError: "",
  };

  if (selectedTarget === "remote") {
    const errors = [];
    const bindingSetupState = await getBindingSetupState({ target: "remote" }).catch((error) => {
      errors.push(error);
      return createDefaultBindingSetupState("remote");
    });
    const probe = connectionConfig.enabled
      ? await probeOpenClawTransport().catch((error) => {
          errors.push(error);
          return { ok: false, detail: error instanceof Error ? error.message : String(error) };
        })
      : { ok: true, detail: "" };

    if (!probe.ok) {
      nextState.binding = null;
      nextState.bindingSetupState = bindingSetupState;
      nextState.modelState = null;
      nextState.skillCatalog = null;
      nextState.gatewayStatus = null;
      nextState.deviceStatus = null;
      nextState.pairingStatus = null;
      nextState.lastError =
        `${probe.detail ?? ""}`.trim() ||
        (errors.find((error) => error instanceof Error)?.message ??
          (errors.length > 0 ? String(errors[0]) : ""));
      nextState.connectionState = createConnectionState({
        target: selectedTarget,
        connectionConfig,
        bindingSetupState,
        lastError: nextState.lastError,
        lastRefreshedAt: nextState.lastRefreshedAt,
      });
      return nextState;
    }

    const gatewayStatus = connectionConfig.enabled
      ? await getLocalGatewayStatus().catch((error) => {
          errors.push(error);
          return null;
        })
      : null;
    const binding = connectionConfig.enabled
      ? await buildLocalOpenClawBinding().catch((error) => {
          errors.push(error);
          return null;
        })
      : null;
    const modelState = connectionConfig.enabled && binding?.agentId
      ? await getLocalModelState(binding.agentId).catch((error) => {
          errors.push(error);
          return null;
        })
      : null;
    const skillCatalog = connectionConfig.enabled
      ? await getLocalSkillCatalog().catch((error) => {
          errors.push(error);
          return null;
        })
      : null;

    nextState.binding = binding;
    nextState.bindingSetupState = bindingSetupState;
    nextState.modelState = modelState;
    nextState.skillCatalog = skillCatalog;
    nextState.gatewayStatus = gatewayStatus;
    nextState.deviceStatus = null;
    nextState.pairingStatus = null;
    nextState.lastError =
      errors.find((error) => error instanceof Error)?.message ??
      (errors.length > 0 ? String(errors[0]) : "");
    nextState.connectionState = createConnectionState({
      target: selectedTarget,
      connectionConfig,
      binding,
      gatewayStatus,
      bindingSetupState,
      lastError: nextState.lastError,
      lastRefreshedAt: nextState.lastRefreshedAt,
    });
    return nextState;
  }

  const errors = [];

  const bindingSetupState = await getBindingSetupState({ target: "local" }).catch((error) => {
    errors.push(error);
    return createDefaultBindingSetupState("local");
  });
  const gatewayStatus = await getLocalGatewayStatus().catch((error) => {
    errors.push(error);
    return null;
  });
  const deviceStatus = await getLocalDeviceStatus().catch((error) => {
    errors.push(error);
    return null;
  });
  const pairingStatus = await getLocalPairingStatus().catch((error) => {
    errors.push(error);
    return null;
  });
  const binding = connectionConfig.enabled
    ? await buildLocalOpenClawBinding().catch((error) => {
        errors.push(error);
        return null;
      })
    : null;
  const modelState = connectionConfig.enabled && binding?.agentId
    ? await getLocalModelState(binding.agentId).catch((error) => {
        errors.push(error);
        return null;
      })
    : null;
  const skillCatalog = connectionConfig.enabled
    ? await getLocalSkillCatalog().catch((error) => {
        errors.push(error);
        return null;
      })
    : null;

  nextState.binding = binding;
  nextState.bindingSetupState = bindingSetupState;
  nextState.modelState = modelState;
  nextState.skillCatalog = skillCatalog;
  nextState.gatewayStatus = gatewayStatus;
  nextState.deviceStatus = deviceStatus;
  nextState.pairingStatus = pairingStatus;
  nextState.lastError =
    errors.find((error) => error instanceof Error)?.message ??
    (errors.length > 0 ? String(errors[0]) : "");
  nextState.connectionState = createConnectionState({
    target: selectedTarget,
    connectionConfig,
    binding,
    gatewayStatus,
    bindingSetupState,
    lastError: nextState.lastError,
    lastRefreshedAt: nextState.lastRefreshedAt,
  });

  return nextState;
}
