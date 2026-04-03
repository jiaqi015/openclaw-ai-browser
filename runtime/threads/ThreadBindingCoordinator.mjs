import { reconcileThreadStoreWithTabs } from "./ThreadStore.mjs";

let unsubscribeBrowserState = null;

export function initThreadBindingCoordinator(subscribeBrowserState) {
  if (typeof unsubscribeBrowserState === "function") {
    unsubscribeBrowserState();
    unsubscribeBrowserState = null;
  }

  if (typeof subscribeBrowserState !== "function") {
    return;
  }

  unsubscribeBrowserState = subscribeBrowserState((snapshot) => {
    void reconcileThreadStoreWithTabs(snapshot?.tabs ?? []).catch(() => {});
  });
}
