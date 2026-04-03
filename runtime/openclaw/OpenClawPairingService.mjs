import { execOpenClawCommand, execOpenClawJson } from "./OpenClawClient.mjs";
import {
  buildLocalDeviceStatus,
  buildLocalPairingStatus,
} from "./OpenClawStatusService.mjs";

export async function getLocalPairingStatus(params = {}) {
  const args = ["pairing", "list", "--json"];
  const channel = `${params?.channel ?? ""}`.trim();
  const accountId = `${params?.accountId ?? ""}`.trim();

  if (channel) {
    args.push("--channel", channel);
  }
  if (accountId) {
    args.push("--account", accountId);
  }

  const payload = await execOpenClawJson(args);
  return buildLocalPairingStatus(payload, { channel, accountId });
}

export async function approveLocalPairingRequest(params = {}) {
  const args = ["pairing", "approve"];
  const code = `${params?.code ?? ""}`.trim();
  const channel = `${params?.channel ?? ""}`.trim();
  const accountId = `${params?.accountId ?? ""}`.trim();

  if (!code) {
    throw new Error("缺少 pairing code");
  }

  if (channel) {
    args.push("--channel", channel);
  }
  if (accountId) {
    args.push("--account", accountId);
  }
  if (params?.notify) {
    args.push("--notify");
  }

  args.push(code);

  await execOpenClawCommand(args, { timeout: 15000, maxBuffer: 1024 * 512 });

  return getLocalPairingStatus({ channel, accountId });
}

export async function getLocalDeviceStatus() {
  const payload = await execOpenClawJson(["devices", "list", "--json"]);
  return buildLocalDeviceStatus(payload);
}

export async function approveLocalDeviceRequest(params = {}) {
  const args = ["devices", "approve", "--json"];
  const requestId = `${params?.requestId ?? ""}`.trim();
  const token = `${params?.token ?? ""}`.trim();
  const password = `${params?.password ?? ""}`.trim();
  const url = `${params?.url ?? ""}`.trim();

  if (params?.latest) {
    args.push("--latest");
  } else if (requestId) {
    args.push(requestId);
  } else {
    throw new Error("缺少待批准的设备请求");
  }

  if (token) {
    args.push("--token", token);
  }
  if (password) {
    args.push("--password", password);
  }
  if (url) {
    args.push("--url", url);
  }

  await execOpenClawCommand(args, { timeout: 15000, maxBuffer: 1024 * 1024 });

  return getLocalDeviceStatus();
}
