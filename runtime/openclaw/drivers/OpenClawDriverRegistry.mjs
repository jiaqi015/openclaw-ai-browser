import {
  getOpenClawRemoteDriver,
  getOpenClawTransportContext,
} from "../OpenClawTransportContext.mjs";
import { localCliDriver } from "./LocalCliDriver.mjs";
import { relayPairedDriver } from "./RelayPairedDriver.mjs";
import { sshCliDriver } from "./SshCliDriver.mjs";
import { openClawEndpointDriver } from "./OpenClawEndpointDriver.mjs";

const drivers = new Map([
  [localCliDriver.id, localCliDriver],
  [sshCliDriver.id, sshCliDriver],
  [relayPairedDriver.id, relayPairedDriver],
  [openClawEndpointDriver.id, openClawEndpointDriver],
]);

export function getOpenClawDriverId(context = getOpenClawTransportContext()) {
  return getOpenClawRemoteDriver(context) ?? "local-cli";
}

export function getOpenClawDriver(context = getOpenClawTransportContext()) {
  return drivers.get(getOpenClawDriverId(context)) ?? localCliDriver;
}

export function buildOpenClawDriverInvocation(
  args = [],
  options = {},
  context = getOpenClawTransportContext(),
) {
  return getOpenClawDriver(context).buildInvocation(args, options, context);
}

export async function probeOpenClawDriverTransport(
  options = {},
  context = options?.context ?? getOpenClawTransportContext(),
) {
  return getOpenClawDriver(context).probeTransport(options, context);
}

export function supportsOpenClawRemoteCliExecution(
  context = getOpenClawTransportContext(),
) {
  return getOpenClawDriver(context).capabilities.remoteCliExecution === true;
}

export function supportsOpenClawSessionTrace(
  context = getOpenClawTransportContext(),
) {
  return getOpenClawDriver(context).capabilities.sessionTrace === true;
}

export function supportsOpenClawGatewayHttpManagement(
  context = getOpenClawTransportContext(),
) {
  return getOpenClawDriver(context).capabilities.gatewayHttpManagement === true;
}
