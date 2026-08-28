import { dbAll, dbBulkPut, dbDelete, dbPut, getSyncQueue, clearSyncQueue, StoreName } from './idb';
import { User } from './types';

export interface NetworkState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  pendingSyncCount: number;
}

type NetworkListener = (state: NetworkState) => void;
const listeners: Set<NetworkListener> = new Set();

let currentState: NetworkState = {
  isOnline: true,
  isSyncing: false,
  lastSyncedAt: null,
  pendingSyncCount: 0,
};

function updateState(partial: Partial<NetworkState>) {
  currentState = { ...currentState, ...partial };
  listeners.forEach((listener) => listener(currentState));
}

export function subscribeNetworkState(listener: NetworkListener): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

export function getNetworkState(): NetworkState {
  return currentState;
}

// Fetch all data for an entity (Offline-first: returns IDB data immediately, fetches server and updates IDB)
export async function fetchEntityData<T extends { id: string }>(entity: StoreName): Promise<T[]> {
  // 1. Get from IndexedDB immediately
  const localData = await dbAll<T>(entity);

  // 2. Try fetching from server in background or right away
  try {
    const res = await fetch(`/api/data/${entity}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      const serverData = (await res.json()) as T[];
      // Update IndexedDB with fresh server data
      await dbBulkPut(entity, serverData);
      updateState({ isOnline: true });
      return serverData;
    } else {
      updateState({ isOnline: false });
    }
  } catch (err) {
    console.warn(`Server unreachable for ${entity}, using IndexedDB:`, err);
    updateState({ isOnline: false });
  }

  return localData;
}

// Save or Update an entity record
export async function saveEntityData<T extends { id: string }>(
  entity: StoreName,
  item: T,
  user?: User | null,
  auditAction?: string,
  auditDetails?: string
): Promise<T> {
  // 1. Save to local IndexedDB immediately
  await dbPut(entity, item, true);

  const syncQueue = await getSyncQueue();
  updateState({ pendingSyncCount: syncQueue.length });

  // 2. Attempt push to server
  try {
    const res = await fetch(`/api/data/${entity}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item,
        auditInfo: user
          ? {
              action: auditAction || `${entity}.update`,
              userId: user.id,
              userLogin: user.login,
              userName: user.fullName,
              userRole: user.rol,
              userOrg: user.org,
              details: auditDetails || `Амал бажарилди (${entity}): ${item.id}`,
            }
          : undefined,
      }),
    });

    if (res.ok) {
      updateState({ isOnline: true, lastSyncedAt: new Date() });
    } else {
      updateState({ isOnline: false });
    }
  } catch {
    updateState({ isOnline: false });
  }

  return item;
}

// Delete an entity record
export async function deleteEntityData(
  entity: StoreName,
  id: string,
  user?: User | null,
  details?: string
): Promise<void> {
  // 1. Delete from local IndexedDB
  await dbDelete(entity, id, true);

  const syncQueue = await getSyncQueue();
  updateState({ pendingSyncCount: syncQueue.length });

  // 2. Attempt delete on server
  try {
    const res = await fetch(`/api/data/${entity}?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      updateState({ isOnline: true, lastSyncedAt: new Date() });
    } else {
      updateState({ isOnline: false });
    }
  } catch {
    updateState({ isOnline: false });
  }
}

// Full Sync mechanism: sends pending offline queue to server
export async function syncPendingQueue(user?: User | null): Promise<boolean> {
  const queue = await getSyncQueue();
  if (queue.length === 0) {
    updateState({ pendingSyncCount: 0 });
    return true;
  }

  updateState({ isSyncing: true });

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue, user }),
    });

    if (res.ok) {
      await clearSyncQueue();
      updateState({
        isOnline: true,
        isSyncing: false,
        pendingSyncCount: 0,
        lastSyncedAt: new Date(),
      });
      return true;
    } else {
      updateState({ isOnline: false, isSyncing: false });
      return false;
    }
  } catch {
    updateState({ isOnline: false, isSyncing: false });
    return false;
  }
}

// Monotonically increasing unique document numbering
export async function fetchNextDocNumber(
  entity: string,
  period?: string | number
): Promise<string> {
  const currentYear = new Date().getFullYear();
  const periodStr = period ? String(period) : String(currentYear);
  const normalizedEntity = entity === 'nakladnoylar' ? 'nakladnoy' : entity;

  try {
    const res = await fetch(`/api/next-doc-number?entity=${encodeURIComponent(normalizedEntity)}&period=${encodeURIComponent(periodStr)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.docNumber) {
        return data.docNumber;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch doc number from server, falling back to local counter:', err);
  }

  // Offline fallback counter from localStorage
  const localKey = `sm_counter_${normalizedEntity}_${periodStr}`;
  let currentVal = 1;
  try {
    const saved = localStorage.getItem(localKey);
    if (saved) {
      currentVal = parseInt(saved, 10) + 1;
    }
    localStorage.setItem(localKey, currentVal.toString());
  } catch {
    currentVal = Date.now() % 10000;
  }

  switch (normalizedEntity) {
    case 'zayavki':
      return `ЗАЯ-${periodStr}-${String(currentVal).padStart(3, '0')}`;
    case 'hisobotlar':
      return `ОТЧ-${periodStr}/${currentVal}`;
    case 'nakladnoy':
      return `ТТН-${periodStr}-${String(currentVal).padStart(3, '0')}`;
    case 'ummZayavki':
      return `УММ-${periodStr}-${String(currentVal).padStart(3, '0')}`;
    case 'pmuZayavki':
      return `ПМУ-${periodStr}-${String(currentVal).padStart(3, '0')}`;
    case 'pmuNakladnoy':
      return `ПМУ-НАКЛ-${String(currentVal).padStart(3, '0')}`;
    default:
      return `DOC-${periodStr}-${String(currentVal).padStart(4, '0')}`;
  }
}

// Global sync controller wrapper
export const syncController = {
  getAll: async <T extends { id: string }>(entity: StoreName): Promise<T[]> => {
    return fetchEntityData<T>(entity);
  },
  saveItem: async <T extends { id: string }>(
    entity: StoreName,
    item: T,
    auditAction?: string,
    auditDetails?: string
  ): Promise<void> => {
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('sm_current_user') : null;
    const user: User | undefined = userStr ? JSON.parse(userStr) : undefined;
    await saveEntityData<T>(entity, item, user, auditAction, auditDetails);
  },
  deleteItem: async (entity: StoreName, id: string, details?: string): Promise<void> => {
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('sm_current_user') : null;
    const user: User | undefined = userStr ? JSON.parse(userStr) : undefined;
    await deleteEntityData(entity, id, user, details);
  },
  getNextDocNumber: async (entity: string, period?: string | number): Promise<string> => {
    return fetchNextDocNumber(entity, period);
  },
  getPendingCount: async (): Promise<number> => {
    const queue = await getSyncQueue();
    return queue.length;
  },
  processSyncQueue: async (): Promise<boolean> => {
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('sm_current_user') : null;
    const user: User | undefined = userStr ? JSON.parse(userStr) : undefined;
    return syncPendingQueue(user);
  },
};

