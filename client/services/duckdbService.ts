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
   * Step 1: Save dataset to IndexedDB (primary storage)
   * Flow: Excel → IndexedDB
   */
  async saveDataset(
    data: DataRow[],
    fileName: string,
    columns: string[]
  ): Promise<LocalDataset> {
    const datasetId = `dataset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const cleanFileName = fileName.replace(/\.csv$/i, '').replace(/[^a-zA-Z0-9_]/g, '_');
    
    // Create dataset metadata
    const dataset: LocalDataset = {
      id: datasetId,
      name: cleanFileName,
      rowCount: data.length,
      columns,
      createdAt: new Date(),
      fileSize: new Blob([JSON.stringify(data)]).size,
      originalFileName: fileName
    };
    
    try {
      // Step 1: Store in IndexedDB (primary storage)
      await this.storeInIndexedDB(datasetId, dataset, data);
      console.log(`Dataset "${cleanFileName}" saved to IndexedDB with ${data.length} rows`);
      
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
  
  private async storeInIndexedDB(datasetId: string, dataset: LocalDataset, data: DataRow[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('LocalDuckDBStorage', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['datasets'], 'readwrite');
        const store = transaction.objectStore('datasets');
        
        const storeData = {
          id: datasetId,
          dataset,
          data
        };
        
        const storeRequest = store.put(storeData);
        storeRequest.onsuccess = () => resolve();
        storeRequest.onerror = () => reject(storeRequest.error);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('datasets')) {
          db.createObjectStore('datasets', { keyPath: 'id' });
        }
      };
    });
  }

  private async loadFromIndexedDB(datasetId: string): Promise<{ dataset: LocalDataset | null; data: DataRow[] | null }> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('LocalDuckDBStorage', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['datasets'], 'readonly');
        const store = transaction.objectStore('datasets');
        
        const getRequest = store.get(datasetId);
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            resolve({ 
              dataset: getRequest.result.dataset, 
              data: getRequest.result.data 
            });
          } else {
            resolve({ dataset: null, data: null });
          }
        };
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  }

  private async getAllDatasetsFromIndexedDB(): Promise<LocalDataset[]> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('LocalDuckDBStorage', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['datasets'], 'readonly');
        const store = transaction.objectStore('datasets');
        
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => {
          const datasets = getAllRequest.result.map(item => item.dataset);
          // Sort by creation date, newest first
          datasets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          resolve(datasets);
        };
        getAllRequest.onerror = () => reject(getAllRequest.error);
      };
    });
  }

  private async removeFromIndexedDB(datasetId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('LocalDuckDBStorage', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['datasets'], 'readwrite');
        const store = transaction.objectStore('datasets');
        
        const deleteRequest = store.delete(datasetId);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      };
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
