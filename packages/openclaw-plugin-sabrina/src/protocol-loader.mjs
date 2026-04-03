let protocolModulePromise = null;

export async function loadSabrinaProtocol() {
  if (!protocolModulePromise) {
    protocolModulePromise = import("@sabrina/sabrina-protocol").catch(() =>
      import("../../sabrina-protocol/index.mjs"),
    );
  }

  return protocolModulePromise;
}
