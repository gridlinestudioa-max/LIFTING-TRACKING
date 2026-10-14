// Rules for syncing one person's data between the device and their account. The data is one document;
// whichever copy changed last wins. Pure logic; the network part lives in src/ui/account.tsx.

export type SyncAction = 'push' | 'pull' | 'none';

/**
 * What to do when the device and the account are compared.
 * No copy in the account yet: upload this device's. Otherwise the newer one wins.
 */
export function syncAction(localUpdatedAt: number, remote: { updatedAt: number } | null, localHasData: boolean): SyncAction {
  if (!remote) return localHasData ? 'push' : 'none';
  if (remote.updatedAt > localUpdatedAt) return 'pull';
  if (localUpdatedAt > remote.updatedAt) return 'push';
  return 'none';
}
