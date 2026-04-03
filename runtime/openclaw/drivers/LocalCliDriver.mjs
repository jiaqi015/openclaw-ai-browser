import {
  buildOpenClawExecArgs,
  buildOpenClawExecOptions,
} from "../OpenClawTransportContext.mjs";

export const localCliDriver = Object.freeze({
  id: "local-cli",
  capabilities: Object.freeze({
    remote: false,
    remoteCliExecution: false,
    sessionTrace: true,
    gatewayHttpManagement: true,
  }),
  buildInvocation(args = [], options = {}, context) {
    return {
      command: "openclaw",
      args: buildOpenClawExecArgs(args, context),
      options: buildOpenClawExecOptions(
        {
          ...options,
        },
        context,
      ),
    };
  },
  async probeTransport() {
    return {
      ok: true,
      detail: "",
    };
  },
});
