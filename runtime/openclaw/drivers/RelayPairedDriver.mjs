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
    return {
      ok: false,
      detail: "当前远程 driver relay-paired 尚未实现。",
    };
  },
});
