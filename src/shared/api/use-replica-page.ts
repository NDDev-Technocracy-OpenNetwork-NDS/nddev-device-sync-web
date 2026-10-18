import type { NdsClient, VaultView } from "@nds/runtime";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRuntime } from "./runtime";

interface RevisionedPage {
  local_revision: bigint;
  observed_seq: bigint;
}
interface PageRead<T> {
  vault: VaultView;
  page: T | null;
  busy: boolean;
}
const localBusy = (error: unknown) => error instanceof Error && error.message === "vault_busy";

// Only cache freshness is decided here. Rust owns data, authority and revisions.
export function useReplicaPage<T extends RevisionedPage>(
  kind: "vault" | "states",
  after: string,
  load: (client: NdsClient, after: string) => Promise<T>,
) {
  const { client, scope, busy, run } = useRuntime();
  const cache = useQueryClient();
  const key = [kind, scope, after];
  const options = queryOptions({
    queryKey: key,
    queryFn: async (): Promise<PageRead<T>> => {
      const previous = cache.getQueryData<PageRead<T>>(key);
      let metadata: VaultView;
      try {
        metadata = await client.vault_snapshot();
      } catch (error) {
        if (localBusy(error) && previous) return { ...previous, busy: true };
        throw error;
      }
      if (!metadata.unlocked) return { vault: metadata, page: null, busy: false };
      const prior = previous?.vault.key_id === metadata.key_id ? previous.page : null;
      if (
        prior &&
        prior.local_revision === metadata.local_revision &&
        prior.observed_seq === metadata.cursor
      ) {
        return { vault: metadata, page: prior, busy: false };
      }
      // A failed read never marks a revision as loaded. The next visible tick retries it.
      try {
        return { vault: metadata, page: await load(client, after), busy: false };
      } catch (error) {
        if (localBusy(error)) return { vault: metadata, page: prior ?? null, busy: true };
        throw error;
      }
    },
  });
  const read = useQuery({ ...options, enabled: !busy, refetchInterval: 1000 });
  function command(action: () => Promise<unknown>) {
    return run(async () => {
      // Settle the one presentation read before mutation; Rust checks fresh authority itself.
      await cache.fetchQuery(options).catch(() => undefined);
      await action();
    });
  }
  return {
    read,
    command,
    reload: () => cache.invalidateQueries({ queryKey: [kind, scope] }),
  };
}
