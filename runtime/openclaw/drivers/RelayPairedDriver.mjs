import { getSabrinaRelayPairingRemoteStateByCode } from "../relay/SabrinaRelayClient.mjs";

export const relayPairedDriver = Object.freeze({
  id: "relay-paired",
  capabilities: Object.freeze({
    remote: true,
    remoteCliExecution: false,
    sessionTrace: false,
    gatewayHttpManagement: false,
  }),
  buildInvocation() {
    throw new Error("当前远程 driver relay-paired 尚未实现。");
  },
  async probeTransport(_options = {}, context) {
    if (!context?.relayUrl) {
      return {
        ok: false,
        detail: "relay-paired 缺少 relay URL。",
      };
    }
    if (!context?.connectCode) {
      return {
        ok: false,
        detail: "relay-paired 缺少连接码。",
      };
    }

    try {
      const payload = await getSabrinaRelayPairingRemoteStateByCode(
        context.relayUrl,
        context.connectCode,
      );
      const pairing = payload?.pairing ?? null;
      if (!pairing) {
        return {
          ok: false,
          detail: "Relay 上还没有这条连接码。",
        };
      }

      if (pairing.status === "active") {
        return {
          ok: false,
          detail:
            `连接码已被${pairing.openclawLabel ? ` ${pairing.openclawLabel}` : "远端 OpenClaw"}认领，` +
            "但 relay 命令通道还没实现。",
        };
      }

      if (pairing.status === "expired") {
        return {
          ok: false,
          detail: "连接码已过期，请重新生成。",
        };
      }

      if (pairing.status === "rejected") {
        return {
          ok: false,
          detail: "连接码已被拒绝，请重新生成。",
        };
      }

      return {
        ok: false,
        detail: "连接码已发布，等待远端 OpenClaw 认领。",
      };
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    }

  },
});
