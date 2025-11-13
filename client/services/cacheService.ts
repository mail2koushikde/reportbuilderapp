interface CachedData {
  id: string;
  data: any[];
  columns: string[];
  source: 'file' | 'snowflake';
  fileName?: string;
  query?: string;
  queryType?: 'table' | 'sql';
  timestamp: number;
  sessionId: string;
}

class CacheService {
  private dbName = 'ReportBuilderCache';
  private version = 1;
  private storeName = 'cachedData';
  private db: IDBDatabase | null = null;
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          store.createIndex('source', 'source', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async cacheData(
    data: any[], 
    columns: string[], 
    source: 'file' | 'snowflake',
    fileName?: string,
    query?: string,
    queryType?: 'table' | 'sql'
  ): Promise<string> {
    if (!this.db) await this.init();

    const cachedData: CachedData = {
      id: `cache_${Date.now()}`,
      data,
      columns,
      source,
      fileName,
      query,
      queryType,
      timestamp: Date.now(),
      sessionId: this.sessionId
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(cachedData);

      request.onsuccess = () => resolve(cachedData.id);
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedData(): Promise<CachedData | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev'); // Get most recent

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          resolve(cursor.value as CachedData);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getCurrentSessionData(): Promise<CachedData | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('sessionId');
      const request = index.get(this.sessionId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async clearCache(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async hasCachedData(): Promise<boolean> {
    const cached = await this.getCachedData();
    return cached !== null;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  async getStorageInfo(): Promise<{ count: number; size: number }> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const data = request.result;
        const size = JSON.stringify(data).length;
        resolve({ count: data.length, size });
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const cacheService = new CacheService();
export type { CachedData };
