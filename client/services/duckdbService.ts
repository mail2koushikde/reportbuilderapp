import * as duckdb from '@duckdb/duckdb-wasm';

export type DataRow = Record<string, any>;

export interface LocalDataset {
  id: string;
  name: string;
  tableName: string;
  rowCount: number;
  columns: string[];
  createdAt: Date;
  fileSize: number;
}

class DuckDBService {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private initialized = false;

  private async initialize(): Promise<void> {
    if (this.initialized && this.db && this.conn) {
      return;
    }

    try {
      // Import DuckDB WASM bundles
      const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
      
      // Select bundle (prefer the browser bundle)
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
      
      // Instantiate worker
      const worker = await duckdb.createWorker(bundle.mainWorker!);
      const logger = new duckdb.ConsoleLogger();
      this.db = new duckdb.AsyncDuckDB(logger, worker);
      
      // Initialize database
      await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      
      // Create connection
      this.conn = await this.db.connect();
      
      // Set up IndexedDB persistent storage
      await this.setupPersistentStorage();
      
      this.initialized = true;
      console.log('DuckDB WASM initialized successfully');
    } catch (error) {
      console.error('Failed to initialize DuckDB WASM:', error);
      throw error;
    }
  }

  private async setupPersistentStorage(): Promise<void> {
    if (!this.conn) return;

    try {
      // Try to install and load httpfs extension for better file handling
      try {
        await this.conn.query("INSTALL httpfs;");
        await this.conn.query("LOAD httpfs;");
        console.log('DuckDB httpfs extension loaded successfully');
      } catch (httpfsError) {
        console.warn('Could not load httpfs extension:', httpfsError);
        // Continue without httpfs
      }

      // Create metadata table for tracking datasets - this is critical
      await this.conn.query(`
        CREATE TABLE IF NOT EXISTS __datasets_metadata (
          id VARCHAR PRIMARY KEY,
          name VARCHAR NOT NULL,
          table_name VARCHAR NOT NULL,
          row_count INTEGER NOT NULL,
          columns VARCHAR NOT NULL,
          created_at TIMESTAMP NOT NULL,
          file_size INTEGER NOT NULL
        );
      `);
      console.log('DuckDB metadata table created successfully');

      // Test the table exists
      await this.conn.query('SELECT COUNT(*) FROM __datasets_metadata;');
      console.log('DuckDB metadata table verified');

    } catch (error) {
      console.error('Critical error setting up DuckDB persistent storage:', error);
      throw error; // This is critical, so throw the error
    }
  }

  private async ensureMetadataTableExists(): Promise<void> {
    if (!this.conn) {
      throw new Error('DuckDB connection not available');
    }

    try {
      // Try to query the table to see if it exists
      await this.conn.query('SELECT COUNT(*) FROM __datasets_metadata LIMIT 1;');
    } catch (error) {
      // Table doesn't exist, create it
      console.log('Creating metadata table...');
      await this.conn.query(`
        CREATE TABLE __datasets_metadata (
          id VARCHAR PRIMARY KEY,
          name VARCHAR NOT NULL,
          table_name VARCHAR NOT NULL,
          row_count INTEGER NOT NULL,
          columns VARCHAR NOT NULL,
          created_at TIMESTAMP NOT NULL,
          file_size INTEGER NOT NULL
        );
      `);
      console.log('Metadata table created successfully');
    }
  }

  async saveDataset(
    data: DataRow[],
    fileName: string,
    columns: string[]
  ): Promise<LocalDataset> {
    await this.initialize();

    if (!this.conn) {
      throw new Error('DuckDB connection not available');
    }

    // Ensure metadata table exists before proceeding
    await this.ensureMetadataTableExists();

    const datasetId = `dataset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tableName = `data_${datasetId}`;
    const cleanFileName = fileName.replace(/\.csv$/i, '').replace(/[^a-zA-Z0-9_]/g, '_');

    try {
      // Create table dynamically based on columns
      const columnDefs = columns.map(col => `"${col}" VARCHAR`).join(', ');
      await this.conn.query(`CREATE TABLE "${tableName}" (${columnDefs});`);
      
      // Insert data in batches for better performance
      const batchSize = 1000;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const values = batch.map(row => {
          const rowValues = columns.map(col => {
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
      
      // Create dataset metadata
      const dataset: LocalDataset = {
        id: datasetId,
        name: cleanFileName,
        tableName,
        rowCount: data.length,
        columns,
        createdAt: new Date(),
        fileSize: new Blob([JSON.stringify(data)]).size
      };
      
      // Save metadata
      await this.conn.query(`
        INSERT INTO __datasets_metadata 
        (id, name, table_name, row_count, columns, created_at, file_size)
        VALUES (
          '${dataset.id}',
          '${dataset.name}',
          '${dataset.tableName}',
          ${dataset.rowCount},
          '${JSON.stringify(dataset.columns)}',
          '${dataset.createdAt.toISOString()}',
          ${dataset.fileSize}
        );
      `);
      
      // Store in IndexedDB for persistence
      await this.storeInIndexedDB(datasetId, dataset, data);
      
      console.log(`Dataset "${cleanFileName}" saved locally with ${data.length} rows`);
      return dataset;
      
    } catch (error) {
      console.error('Failed to save dataset to DuckDB:', error);
      // Cleanup on error
      try {
        await this.conn.query(`DROP TABLE IF EXISTS "${tableName}";`);
        await this.conn.query(`DELETE FROM __datasets_metadata WHERE id = '${datasetId}';`);
      } catch (cleanupError) {
        console.warn('Failed to cleanup after error:', cleanupError);
      }
      throw error;
    }
  }

  async queryDataset(datasetId: string, query: string): Promise<any[]> {
    await this.initialize();
    
    if (!this.conn) {
      throw new Error('DuckDB connection not available');
    }

    try {
      const dataset = await this.getDataset(datasetId);
      if (!dataset) {
        throw new Error(`Dataset ${datasetId} not found`);
      }

      // Replace table references with actual table name
      const processedQuery = query.replace(/\{table\}/g, `"${dataset.tableName}"`);
      
      const result = await this.conn.query(processedQuery);
      return result.toArray().map(row => Object.fromEntries(row));
    } catch (error) {
      console.error('Failed to query dataset:', error);
      throw error;
    }
  }

  async getDataset(datasetId: string): Promise<LocalDataset | null> {
    try {
      await this.initialize();

      if (!this.conn) {
        console.warn('DuckDB connection not available for getting dataset');
        return null;
      }

      // Check if metadata table exists first
      try {
        await this.conn.query('SELECT COUNT(*) FROM __datasets_metadata LIMIT 1;');
      } catch (tableError) {
        console.warn('Metadata table does not exist when getting dataset');
        return null;
      }

      const result = await this.conn.query(`
        SELECT * FROM __datasets_metadata WHERE id = '${datasetId}';
      `);

      const rows = result.toArray();
      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      return {
        id: row[0] as string,
        name: row[1] as string,
        tableName: row[2] as string,
        rowCount: row[3] as number,
        columns: JSON.parse(row[4] as string),
        createdAt: new Date(row[5] as string),
        fileSize: row[6] as number
      };
    } catch (error) {
      console.error('Failed to get dataset:', error);
      return null;
    }
  }

  async listDatasets(): Promise<LocalDataset[]> {
    try {
      await this.initialize();

      if (!this.conn) {
        console.warn('DuckDB connection not available for listing datasets');
        return [];
      }

      // Check if metadata table exists first
      try {
        await this.conn.query('SELECT COUNT(*) FROM __datasets_metadata LIMIT 1;');
      } catch (tableError) {
        console.warn('Metadata table does not exist, creating it...');
        await this.setupPersistentStorage();
      }

      const result = await this.conn.query(`
        SELECT * FROM __datasets_metadata ORDER BY created_at DESC;
      `);

      return result.toArray().map(row => ({
        id: row[0] as string,
        name: row[1] as string,
        tableName: row[2] as string,
        rowCount: row[3] as number,
        columns: JSON.parse(row[4] as string),
        createdAt: new Date(row[5] as string),
        fileSize: row[6] as number
      }));
    } catch (error) {
      console.error('Failed to list datasets:', error);
      return [];
    }
  }

  async deleteDataset(datasetId: string): Promise<void> {
    await this.initialize();
    
    if (!this.conn) {
      throw new Error('DuckDB connection not available');
    }

    try {
      const dataset = await this.getDataset(datasetId);
      if (!dataset) {
        throw new Error(`Dataset ${datasetId} not found`);
      }

      // Drop the data table
      await this.conn.query(`DROP TABLE IF EXISTS "${dataset.tableName}";`);
      
      // Remove metadata
      await this.conn.query(`DELETE FROM __datasets_metadata WHERE id = '${datasetId}';`);
      
      // Remove from IndexedDB
      await this.removeFromIndexedDB(datasetId);
      
      console.log(`Dataset "${dataset.name}" deleted successfully`);
    } catch (error) {
      console.error('Failed to delete dataset:', error);
      throw error;
    }
  }

  async getStorageInfo(): Promise<{
    datasetCount: number;
    totalRows: number;
    estimatedSizeMB: number;
  }> {
    try {
      await this.initialize();

      if (!this.conn) {
        return { datasetCount: 0, totalRows: 0, estimatedSizeMB: 0 };
      }

      // Check if metadata table exists first
      try {
        await this.conn.query('SELECT COUNT(*) FROM __datasets_metadata LIMIT 1;');
      } catch (tableError) {
        console.warn('Metadata table does not exist when getting storage info');
        return { datasetCount: 0, totalRows: 0, estimatedSizeMB: 0 };
      }

      const result = await this.conn.query(`
        SELECT
          COUNT(*) as dataset_count,
          COALESCE(SUM(row_count), 0) as total_rows,
          COALESCE(SUM(file_size), 0) as total_bytes
        FROM __datasets_metadata;
      `);

      const row = result.toArray()[0];
      return {
        datasetCount: row[0] as number,
        totalRows: row[1] as number,
        estimatedSizeMB: Math.round((row[2] as number) / (1024 * 1024) * 100) / 100
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return { datasetCount: 0, totalRows: 0, estimatedSizeMB: 0 };
    }
  }

  private async storeInIndexedDB(datasetId: string, dataset: LocalDataset, data: DataRow[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('DuckDBStorage', 1);
      
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

  private async removeFromIndexedDB(datasetId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('DuckDBStorage', 1);
      
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
      if (this.conn) {
        await this.conn.close();
        this.conn = null;
      }
      if (this.db) {
        await this.db.terminate();
        this.db = null;
      }
      this.initialized = false;
    } catch (error) {
      console.error('Error during DuckDB cleanup:', error);
    }
  }
}

// Export singleton instance
export const duckdbService = new DuckDBService();
