import * as duckdb from '@duckdb/duckdb-wasm';

export type DataRow = Record<string, any>;

export interface LocalDataset {
  id: string;
  name: string;
  rowCount: number;
  columns: string[];
  createdAt: Date;
  fileSize: number;
  originalFileName: string;
  version: number;
  userEmail: string;
  updatedAt: Date;
}

class DuckDBService {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private initialized = false;
  private loadedTables = new Set<string>(); // Track which datasets are currently loaded in DuckDB

  private async initialize(): Promise<void> {
    if (this.initialized && this.db && this.conn) {
      return;
    }

    try {
      console.log('Initializing DuckDB WASM...');
      
      // Import DuckDB WASM bundles
      const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
      console.log('DuckDB bundles loaded');
      
      // Select bundle (prefer the browser bundle)
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
      console.log('DuckDB bundle selected');
      
      // Instantiate worker
      const worker = await duckdb.createWorker(bundle.mainWorker!);
      const logger = new duckdb.ConsoleLogger();
      this.db = new duckdb.AsyncDuckDB(logger, worker);
      console.log('DuckDB worker created');
      
      // Initialize database
      await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      console.log('DuckDB database instantiated');
      
      // Create connection
      this.conn = await this.db.connect();
      console.log('DuckDB connection established');
      
      this.initialized = true;
      console.log('DuckDB WASM initialized successfully - ready for queries');
    } catch (error) {
      console.error('Failed to initialize DuckDB WASM:', error);
      // Reset state on failure
      this.initialized = false;
      this.db = null;
      this.conn = null;
      throw error;
    }
  }

  /**
   * Step 1: Save dataset to IndexedDB (primary storage) with versioning
   * Flow: Excel → IndexedDB
   */
  async saveDataset(
    data: DataRow[],
    fileName: string,
    columns: string[],
    userEmail: string,
    version?: number
  ): Promise<LocalDataset> {
    const cleanFileName = fileName.replace(/\.csv$/i, '').replace(/[^a-zA-Z0-9_]/g, '_');

    // If no version specified, determine next version
    const finalVersion = version || await this.getNextVersion(userEmail, fileName);

    const datasetId = `dataset_${userEmail}_${cleanFileName}_v${finalVersion}_${Date.now()}`;

    // Create dataset metadata
    const dataset: LocalDataset = {
      id: datasetId,
      name: cleanFileName,
      rowCount: data.length,
      columns,
      createdAt: new Date(),
      updatedAt: new Date(),
      fileSize: new Blob([JSON.stringify(data)]).size,
      originalFileName: fileName,
      version: finalVersion,
      userEmail
    };

    try {
      // Step 1: Store in IndexedDB (primary storage)
      await this.storeInIndexedDB(datasetId, dataset, data);
      console.log(`Dataset "${cleanFileName}" v${finalVersion} saved to IndexedDB with ${data.length} rows`);

      return dataset;

    } catch (error) {
      console.error('Failed to save dataset to IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Step 2: Load dataset from IndexedDB into DuckDB for querying
   * Flow: IndexedDB → DuckDB WASM
   */
  private async loadDatasetIntoMemory(datasetId: string): Promise<{ dataset: LocalDataset; tableName: string }> {
    // Check if already loaded
    if (this.loadedTables.has(datasetId)) {
      const dataset = await this.getDatasetMetadata(datasetId);
      if (!dataset) throw new Error(`Dataset ${datasetId} not found`);
      return { dataset, tableName: `data_${datasetId}` };
    }

    await this.initialize();
    
    if (!this.conn) {
      throw new Error('DuckDB connection not available');
    }

    // Load from IndexedDB
    const { dataset, data } = await this.loadFromIndexedDB(datasetId);
    if (!dataset || !data) {
      throw new Error(`Dataset ${datasetId} not found in IndexedDB`);
    }

    const tableName = `data_${datasetId}`;
    
    try {
      console.log(`Loading dataset "${dataset.name}" from IndexedDB into DuckDB...`);
      
      // Create table in DuckDB memory
      const columnDefs = dataset.columns.map(col => `"${col}" VARCHAR`).join(', ');
      await this.conn.query(`CREATE TABLE "${tableName}" (${columnDefs});`);
      
      // Insert data in batches for better performance
      const batchSize = 1000;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const values = batch.map(row => {
          const rowValues = dataset.columns.map(col => {
            const value = row[col];
            if (value === null || value === undefined) return 'NULL';
            if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
            return value;
          }).join(', ');
          return `(${rowValues})`;
        }).join(', ');
        
        if (values) {
          await this.conn.query(`INSERT INTO "${tableName}" VALUES ${values};`);
        }
      }
      
      // Mark as loaded
      this.loadedTables.add(datasetId);
      console.log(`Dataset "${dataset.name}" loaded into DuckDB memory for querying`);
      
      return { dataset, tableName };
      
    } catch (error) {
      console.error('Failed to load dataset into DuckDB:', error);
      // Cleanup on error
      try {
        await this.conn.query(`DROP TABLE IF EXISTS "${tableName}";`);
      } catch (cleanupError) {
        console.warn('Failed to cleanup table after error:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * Step 3: Query dataset using DuckDB
   * Flow: DuckDB WASM → SQL query → Results
   */
  async queryDataset(datasetId: string, query: string): Promise<any[]> {
    try {
      // Load dataset into memory if not already loaded
      const { dataset, tableName } = await this.loadDatasetIntoMemory(datasetId);
      
      if (!this.conn) {
        throw new Error('DuckDB connection not available');
      }

      // Replace table references with actual table name
      const processedQuery = query.replace(/\{table\}/g, `"${tableName}"`);
      
      console.log(`Executing query on dataset "${dataset.name}": ${processedQuery}`);
      const result = await this.conn.query(processedQuery);
      return result.toArray().map(row => Object.fromEntries(row));
      
    } catch (error) {
      console.error('Failed to query dataset:', error);
      throw error;
    }
  }

  /**
   * Get all available datasets from IndexedDB
   */
  async listDatasets(): Promise<LocalDataset[]> {
    try {
      return await this.getAllDatasetsFromIndexedDB();
    } catch (error) {
      console.error('Failed to list datasets:', error);
      return [];
    }
  }

  /**
   * Check if a file exists and get conflict information for local storage
   */
  async checkLocalFileConflict(
    userEmail: string,
    originalFileName: string
  ): Promise<{
    exists: boolean;
    versions: Array<{ version: number; id: string; createdAt: string }>;
    nextVersion: number;
  }> {
    try {
      const allDatasets = await this.getAllDatasetsFromIndexedDB();
      const userFileVersions = allDatasets
        .filter(dataset =>
          dataset.userEmail === userEmail &&
          dataset.originalFileName === originalFileName
        )
        .map(dataset => ({
          version: dataset.version,
          id: dataset.id,
          createdAt: dataset.createdAt.toISOString()
        }))
        .sort((a, b) => b.version - a.version);

      const exists = userFileVersions.length > 0;
      const nextVersion = exists
        ? Math.max(...userFileVersions.map(v => v.version)) + 1
        : 1;

      return {
        exists,
        versions: userFileVersions,
        nextVersion
      };
    } catch (error) {
      console.error('Failed to check local file conflict:', error);
      return { exists: false, versions: [], nextVersion: 1 };
    }
  }

  /**
   * Get next version number for a file
   */
  async getNextVersion(userEmail: string, originalFileName: string): Promise<number> {
    const conflict = await this.checkLocalFileConflict(userEmail, originalFileName);
    return conflict.nextVersion;
  }

  /**
   * Get all versions of a specific file for a user
   */
  async getLocalFileVersions(
    userEmail: string,
    originalFileName: string
  ): Promise<LocalDataset[]> {
    try {
      const allDatasets = await this.getAllDatasetsFromIndexedDB();
      return allDatasets
        .filter(dataset =>
          dataset.userEmail === userEmail &&
          dataset.originalFileName === originalFileName
        )
        .sort((a, b) => b.version - a.version);
    } catch (error) {
      console.error('Failed to get local file versions:', error);
      return [];
    }
  }

  /**
   * Get all uploads for a specific user (for FileHistory integration)
   */
  async getLocalUserUploads(userEmail: string): Promise<LocalDataset[]> {
    try {
      const allDatasets = await this.getAllDatasetsFromIndexedDB();
      return allDatasets
        .filter(dataset => dataset.userEmail === userEmail)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (error) {
      console.error('Failed to get local user uploads:', error);
      return [];
    }
  }

  /**
   * Delete a specific version of a file
   */
  async deleteLocalFileVersion(
    userEmail: string,
    originalFileName: string,
    version: number
  ): Promise<void> {
    try {
      const allDatasets = await this.getAllDatasetsFromIndexedDB();
      const targetDataset = allDatasets.find(dataset =>
        dataset.userEmail === userEmail &&
        dataset.originalFileName === originalFileName &&
        dataset.version === version
      );

      if (targetDataset) {
        await this.deleteDataset(targetDataset.id);
        console.log(`Deleted local file version: ${originalFileName} v${version}`);
      }
    } catch (error) {
      console.error('Failed to delete local file version:', error);
      throw error;
    }
  }

  /**
   * Overwrite an existing version (delete old, save new with same version)
   */
  async overwriteLocalFile(
    data: DataRow[],
    fileName: string,
    columns: string[],
    userEmail: string,
    version: number
  ): Promise<LocalDataset> {
    try {
      // Delete existing version
      await this.deleteLocalFileVersion(userEmail, fileName, version);

      // Save new data with same version
      return await this.saveDataset(data, fileName, columns, userEmail, version);
    } catch (error) {
      console.error('Failed to overwrite local file:', error);
      throw error;
    }
  }

  /**
   * Get specific dataset metadata from IndexedDB
   */
  async getDatasetMetadata(datasetId: string): Promise<LocalDataset | null> {
    try {
      const { dataset } = await this.loadFromIndexedDB(datasetId);
      return dataset;
    } catch (error) {
      console.error('Failed to get dataset metadata:', error);
      return null;
    }
  }

  /**
   * Delete dataset from IndexedDB and unload from DuckDB
   */
  async deleteDataset(datasetId: string): Promise<void> {
    try {
      // Remove from DuckDB memory if loaded
      if (this.loadedTables.has(datasetId) && this.conn) {
        const tableName = `data_${datasetId}`;
        await this.conn.query(`DROP TABLE IF EXISTS "${tableName}";`);
        this.loadedTables.delete(datasetId);
        console.log(`Dataset ${datasetId} unloaded from DuckDB memory`);
      }
      
      // Remove from IndexedDB
      await this.removeFromIndexedDB(datasetId);
      console.log(`Dataset ${datasetId} deleted from IndexedDB`);
      
    } catch (error) {
      console.error('Failed to delete dataset:', error);
      throw error;
    }
  }

  /**
   * Get storage information
   */
  async getStorageInfo(): Promise<{
    datasetCount: number;
    totalRows: number;
    estimatedSizeMB: number;
    loadedInMemory: number;
  }> {
    try {
      const datasets = await this.listDatasets();
      const totalRows = datasets.reduce((sum, ds) => sum + ds.rowCount, 0);
      const totalBytes = datasets.reduce((sum, ds) => sum + ds.fileSize, 0);
      
      return {
        datasetCount: datasets.length,
        totalRows,
        estimatedSizeMB: Math.round(totalBytes / (1024 * 1024) * 100) / 100,
        loadedInMemory: this.loadedTables.size
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return { datasetCount: 0, totalRows: 0, estimatedSizeMB: 0, loadedInMemory: 0 };
    }
  }

  /**
   * Unload dataset from DuckDB memory to free up resources
   */
  async unloadDataset(datasetId: string): Promise<void> {
    if (!this.loadedTables.has(datasetId) || !this.conn) {
      return;
    }

    try {
      const tableName = `data_${datasetId}`;
      await this.conn.query(`DROP TABLE IF EXISTS "${tableName}";`);
      this.loadedTables.delete(datasetId);
      console.log(`Dataset ${datasetId} unloaded from memory`);
    } catch (error) {
      console.error('Failed to unload dataset from memory:', error);
    }
  }

  /**
   * Clean up all loaded datasets from memory
   */
  async clearMemory(): Promise<void> {
    if (!this.conn) return;

    try {
      for (const datasetId of this.loadedTables) {
        const tableName = `data_${datasetId}`;
        await this.conn.query(`DROP TABLE IF EXISTS "${tableName}";`);
      }
      this.loadedTables.clear();
      console.log('All datasets unloaded from DuckDB memory');
    } catch (error) {
      console.error('Failed to clear DuckDB memory:', error);
    }
  }

  // IndexedDB operations (primary storage)
  private readonly DB_NAME = 'LocalDuckDBStorage';
  private readonly STORE_NAME = 'datasets';

  private async openDBEnsureStore(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      // Open without specifying a version to avoid VersionError when DB already exists with higher version
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(this.DB_NAME);
      } catch (e) {
        return reject(e);
      }

      request.onerror = () => {
        // If we hit a VersionError due to lower version, retry by opening without version (already done)
        reject(request.error);
      };

      request.onupgradeneeded = (event) => {
        // DB is being created for the first time (version 1) or upgraded; ensure store exists
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // If store is missing (edge case), bump version by 1 to create it
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const currentVersion = db.version;
          db.close();
          const upgradeRequest = indexedDB.open(this.DB_NAME, currentVersion + 1);
          upgradeRequest.onerror = () => reject(upgradeRequest.error);
          upgradeRequest.onupgradeneeded = (e) => {
            const udb = (e.target as IDBOpenDBRequest).result;
            if (!udb.objectStoreNames.contains(this.STORE_NAME)) {
              udb.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
            }
          };
          upgradeRequest.onsuccess = (e2) => {
            resolve((e2.target as IDBOpenDBRequest).result);
          };
          return;
        }
        resolve(db);
      };
    });
  }

  private async storeInIndexedDB(datasetId: string, dataset: LocalDataset, data: DataRow[]): Promise<void> {
    const db = await this.openDBEnsureStore();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const storeData = { id: datasetId, dataset, data };
        const storeRequest = store.put(storeData);
        storeRequest.onsuccess = () => { db.close(); resolve(); };
        storeRequest.onerror = () => { db.close(); reject(storeRequest.error); };
      } catch (e) {
        db.close();
        reject(e);
      }
    });
  }

  private async loadFromIndexedDB(datasetId: string): Promise<{ dataset: LocalDataset | null; data: DataRow[] | null }> {
    const db = await this.openDBEnsureStore();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const getRequest = store.get(datasetId);
        getRequest.onsuccess = () => {
          const result = getRequest.result;
          db.close();
          if (result) {
            resolve({ dataset: result.dataset, data: result.data });
          } else {
            resolve({ dataset: null, data: null });
          }
        };
        getRequest.onerror = () => { db.close(); reject(getRequest.error); };
      } catch (e) {
        db.close();
        reject(e);
      }
    });
  }

  private async getAllDatasetsFromIndexedDB(): Promise<LocalDataset[]> {
    const db = await this.openDBEnsureStore();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => {
          const results = getAllRequest.result as Array<{ id: string; dataset: LocalDataset; data: DataRow[] }>;
          db.close();
          const datasets = (results || []).map(item => ({
            ...item.dataset,
            createdAt: new Date(item.dataset.createdAt)
          }));
          datasets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          resolve(datasets);
        };
        getAllRequest.onerror = () => { db.close(); reject(getAllRequest.error); };
      } catch (e) {
        db.close();
        reject(e);
      }
    });
  }

  private async removeFromIndexedDB(datasetId: string): Promise<void> {
    const db = await this.openDBEnsureStore();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const deleteRequest = store.delete(datasetId);
        deleteRequest.onsuccess = () => { db.close(); resolve(); };
        deleteRequest.onerror = () => { db.close(); reject(deleteRequest.error); };
      } catch (e) {
        db.close();
        reject(e);
      }
    });
  }

  async cleanup(): Promise<void> {
    try {
      // Clear all loaded datasets from memory
      await this.clearMemory();
      
      // Close DuckDB connection
      if (this.conn) {
        await this.conn.close();
        this.conn = null;
      }
      if (this.db) {
        await this.db.terminate();
        this.db = null;
      }
      this.initialized = false;
      console.log('DuckDB service cleanup completed');
    } catch (error) {
      console.error('Error during DuckDB cleanup:', error);
    }
  }
}

// Export singleton instance
export const duckdbService = new DuckDBService();
