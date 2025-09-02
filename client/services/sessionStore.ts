// Lightweight IndexedDB-backed session storage to avoid localStorage quota issues
// Stores a single record with key 'current' containing the session JSON string

export interface SessionRecord {
  key: string;
  data: string;
  updatedAt: number;
}

const DB_NAME = 'marcom_finance_session_db';
const STORE_NAME = 'sessions';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = fn(store);

    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
    };
  });
}

export const sessionStore = {
  async save(json: string): Promise<void> {
    if (typeof indexedDB === 'undefined') return; // No-op if IDB not available
    const record: SessionRecord = {
      key: 'current',
      data: json,
      updatedAt: Date.now(),
    };
    await withStore('readwrite', (store) => store.put(record));
  },

  async load(): Promise<string | null> {
    if (typeof indexedDB === 'undefined') return null;
    try {
      const record = await withStore<SessionRecord | undefined>('readonly', (store) => store.get('current'));
      return record && (record as any).data ? (record as any).data : null;
    } catch {
      return null;
    }
  },

  async clear(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    try {
      await withStore('readwrite', (store) => store.delete('current'));
    } catch {
      // ignore
    }
  },
};
