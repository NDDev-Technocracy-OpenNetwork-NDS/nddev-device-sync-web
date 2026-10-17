import type { Asset } from "./assets";

declare const self: ServiceWorkerGlobalScope;
// Injected from the finished artifact by the owning build, never from the network.
declare const BUILD: string;
declare const ASSETS: readonly Asset[];

const CACHE = `nds-shell-${BUILD}`;
const paths = new Map<string, Asset>(ASSETS.map((asset) => [`/${asset.path}`, asset]));
const repairs = new Map<string, Promise<Response>>();
const ownedCache = /^nds-shell-[a-f0-9]{64}$/;
self.addEventListener("message", (event) => {
  const data: unknown = event.data;
  const port = event.ports[0];
  if (
    data !== null &&
    typeof data === "object" &&
    "type" in data &&
    data.type === "nds-shell-build" &&
    event.ports.length === 1 &&
    port
  ) {
    port.postMessage({ build: BUILD });
    port.close();
  }
});
async function workerCache(worker: ServiceWorker | null): Promise<string | null> {
  if (!worker) return null;
  return new Promise<string>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      reject(new Error("shell_build_unavailable"));
    }, 2000);
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      clearTimeout(timer);
      channel.port1.close();
      const data = event.data;
      if (
        data !== null &&
        typeof data === "object" &&
        "build" in data &&
        typeof data.build === "string" &&
        /^[a-f0-9]{64}$/.test(data.build)
      )
        resolve(`nds-shell-${data.build}`);
      else reject(new Error("shell_build_invalid"));
    };
    worker.postMessage({ type: "nds-shell-build" }, [channel.port2]);
  });
}
async function verifiedAsset(path: string, asset: Asset): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(path, {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok || response.type === "opaque" || !response.body)
      throw new Error("asset_unavailable");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > asset.bytes) {
          await reader.cancel();
          throw new Error("asset_invalid");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    if (length !== asset.bytes) throw new Error("asset_invalid");
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    if (hash !== asset.sha256) throw new Error("asset_invalid");
    const headers = new Headers(response.headers);
    // Fetch has already decoded any content encoding.
    headers.delete("content-encoding");
    headers.delete("content-length");
    return new Response(bytes, { status: response.status, headers });
  } finally {
    clearTimeout(timer);
  }
}
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const retained = new Set(
        await Promise.all([
          workerCache(self.registration.active),
          workerCache(self.registration.waiting),
        ]),
      );
      // A worker-only change has a different BUILD. Never mutate a live client's cache.
      if (retained.has(CACHE)) return;
      // A failed installation leaves the previous waiting worker registered. Retain
      // active, waiting and candidate builds; only installation prunes stale builds.
      for (const key of await caches.keys()) {
        if (ownedCache.test(key) && !retained.has(key) && key !== CACHE) await caches.delete(key);
      }
      const cache = await caches.open(CACHE);
      try {
        for (const asset of ASSETS) {
          const path = `/${asset.path}`;
          await cache.put(path, await verifiedAsset(path, asset));
        }
      } catch (error) {
        await caches.delete(CACHE);
        throw error;
      }
    })(),
  ),
);
// No skipWaiting: new assets must not be mixed into an active old client.
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const path = url.pathname === "/" ? "/index.html" : url.pathname;
  const asset = paths.get(path);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.search || !asset)
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const response = await cache.match(path);
      if (response) return response;
      // Repair only this exact build. A failed repair never deletes operational data.
      try {
        let pending = repairs.get(path);
        if (!pending) {
          if (repairs.size >= 16) throw new Error("asset_busy");
          pending = (async () => {
            try {
              const restored = await verifiedAsset(path, asset);
              await cache.put(path, restored.clone());
              return restored;
            } finally {
              repairs.delete(path);
            }
          })();
          repairs.set(path, pending);
        }
        return (await pending).clone();
      } catch {
        return new Response(null, { status: 503 });
      }
    })(),
  );
});
