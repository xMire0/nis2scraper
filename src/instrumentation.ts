export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const state = globalThis as typeof globalThis & {
      discoveryTimer?: ReturnType<typeof setInterval>;
    };
    if (state.discoveryTimer) return;
    const { runDiscovery } = await import("./lib/intelligence/discovery");
    const { runAutomaticEnrichment } =
      await import("./lib/intelligence/automatic-enrichment");
    // Durable cursors and DB leases allow multiple long-running Node instances.
    state.discoveryTimer = setInterval(() => {
      void runAutomaticEnrichment()
        .then(() => runDiscovery())
        .catch(() => {});
    }, 60000);
    state.discoveryTimer.unref();
  }
}
