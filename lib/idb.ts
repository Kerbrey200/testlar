// IndexedDB Client-Side Offline Caching & Synchronization Layer

const DB_NAME = 'StroyManager_OfflineDB';
const DB_VERSION = 1;

export const STORES_LIST = [
  'users',
  'objects',
  'materials',
  'mechanisms',
  'zayavki',
  'hisobotlar',
  'ummZayavki',
  'pmuZayavki',
  'pmuNakladnoy',
  'nakladnoy',
  'nakladnoylar',
  'stocks',
  'sfso',
  'accounts',
  'synonyms',
  'invoices',
  'activity',
  'activities',
  'sync_queue',
] as const;

export type StoreName = (typeof STORES_LIST)[number];

let dbInstance: IDBDatabase | null = null;

export function openIndexedDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only available in browser'));
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      STORES_LIST.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          if (storeName === 'sync_queue') {
            db.createObjectStore(storeName, { keyPath: 'queueId', autoIncrement: true });
          } else {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
      });
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// dbGet - fetch single record from store
export async function dbGet<T>(storeName: StoreName, id: string): Promise<T | null> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`IDB dbGet failed for ${storeName}/${id}:`, err);
    return null;
  }
}

// dbPut - save/update single record in store
export async function dbPut<T extends { id: string }>(storeName: StoreName, record: T, queueSync = true): Promise<void> {
  try {
    const db = await openIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    if (queueSync && storeName !== 'sync_queue') {
      await addToSyncQueue({
        storeName,
        action: 'put',
        data: record,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn(`IDB dbPut failed for ${storeName}:`, err);
  }
}

// dbAll - get all records from store
export async function dbAll<T>(storeName: StoreName): Promise<T[]> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`IDB dbAll failed for ${storeName}:`, err);
    return [];
  }
}

// dbDelete - remove record from store
export async function dbDelete(storeName: StoreName, id: string, queueSync = true): Promise<void> {
  try {
    const db = await openIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    if (queueSync && storeName !== 'sync_queue') {
      await addToSyncQueue({
        storeName,
        action: 'delete',
        id,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn(`IDB dbDelete failed for ${storeName}:`, err);
  }
}

// dbBulkPut - replace or seed multiple records without queuing individual syncs
export async function dbBulkPut<T extends { id: string }>(storeName: StoreName, records: T[]): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      records.forEach((rec) => store.put(rec));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`IDB dbBulkPut failed for ${storeName}:`, err);
  }
}

interface SyncQueueItem {
  queueId?: number;
  storeName: StoreName;
  action: 'put' | 'delete';
  id?: string;
  data?: unknown;
  timestamp: string;
}

async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    store.add(item);
  } catch (err) {
    console.warn('Failed to add to sync queue:', err);
  }
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function clearSyncQueue(): Promise<void> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    store.clear();
  } catch (err) {
    console.warn('Failed to clear sync queue:', err);
  }
}
