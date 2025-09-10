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

  private DB_FILE_NAME = 'opfs://fusion_local.duckdb';
  private readonly META_TABLE = 'datasets_meta';

  private async removePersistentFileIfExists(path: string): Promise<void> {
    try {
      const fileName = path.replace(/^opfs:\/\//, '').replace(/^\/+/, '');
      const anyNav: any = navigator as any;
      if (anyNav?.storage?.getDirectory) {
        const root = await anyNav.storage.getDirectory();
        try {
          await root.removeEntry(fileName, { recursive: true } as any);
        } catch {}
      }
    } catch {}
  }

  private async initialize(): Promise<void> {
    if (this.initialized && this.db && this.conn) return;

    try {
      await this.cleanup();

      const bundles = duckdb.getJsDelivrBundles();
      const bundle = await duckdb.selectBundle(bundles);

      const worker = await duckdb.createWorker(bundle.mainWorker!);
      const logger = new duckdb.ConsoleLogger();
      this.db = new duckdb.AsyncDuckDB(logger, worker);
      await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);

      // Open a persistent database file stored in OPFS/IDBFS
      try {
        await this.db.open({ path: this.DB_FILE_NAME, accessMode: duckdb.DuckDBAccessMode.READ_WRITE });
      } catch (e: any) {
        const msg = (e && (e.message || e.toString?.())) || String(e);
        const isInvalid = typeof msg === 'string' && msg.includes('not a valid DuckDB database file');
        if (isInvalid) {
          await this.removePersistentFileIfExists(this.DB_FILE_NAME);
          try {
            await this.db.open({ path: this.DB_FILE_NAME, accessMode: duckdb.DuckDBAccessMode.READ_WRITE });
          } catch {
            // Try a fresh unique file
            this.DB_FILE_NAME = `/fusion_local_${Date.now()}.duckdb`;
            await this.db.open({ path: this.DB_FILE_NAME });
          }
        } else {
          // For other errors, try a fresh file directly
          this.DB_FILE_NAME = `/fusion_local_${Date.now()}.duckdb`;
          await this.db.open({ path: this.DB_FILE_NAME });
        }
      }

      this.conn = await this.db.connect();

      // Ensure metadata table exists inside DuckDB (persisted)
      await this.conn.query(`
        CREATE TABLE IF NOT EXISTS ${this.META_TABLE} (
          id TEXT PRIMARY KEY,
          name TEXT,
          original_file_name TEXT,
          user_email TEXT,
          version INTEGER,
          row_count INTEGER,
          columns TEXT,
          file_size BIGINT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          table_name TEXT
        );
      `);

      this.initialized = true;
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }

  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  private tableNameForId(datasetId: string): string {
    return `data_${this.sanitizeName(datasetId)}`;
  }

  async saveDataset(
    data: DataRow[],
    fileName: string,
    columns: string[],
    userEmail: string,
    version?: number
  ): Promise<LocalDataset> {
    await this.initialize();
    if (!this.conn) throw new Error('DuckDB connection not available');

    const cleanFileName = fileName.replace(/\.csv$/i, '').replace(/[^a-zA-Z0-9_]/g, '_');
    const finalVersion = version || await this.getNextVersion(userEmail, fileName);
    const datasetId = `dataset_${userEmail}_${cleanFileName}_v${finalVersion}_${Date.now()}`;
    const tableName = this.tableNameForId(datasetId);

    // Estimate size from JSON blob (approximation)
    const estimatedSize = new Blob([JSON.stringify(data)]).size;

    // Create data table with VARCHAR columns to avoid type issues
    const columnDefs = columns.map((c) => `"${c}" VARCHAR`).join(', ');
    await this.conn.query(`CREATE TABLE "${tableName}" (${columnDefs});`);

    // Insert data in batches
    const batchSize = 1000;
    let insertedRows = 0;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const values = batch.map((row) => {
        const rowValues = columns.map((col) => {
          const value = row[col];
          if (value === null || value === undefined) return 'NULL';
          if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
          return String(value);
        }).join(', ');
        return `(${rowValues})`;
      }).join(', ');
      if (values) {
        await this.conn.query(`INSERT INTO "${tableName}" VALUES ${values};`);
        insertedRows += batch.length;
      }
    }

    const nowIso = new Date().toISOString();
    await this.conn.query(
      `INSERT OR REPLACE INTO ${this.META_TABLE} (
        id, name, original_file_name, user_email, version, row_count, columns, file_size, created_at, updated_at, table_name
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      );`,
      {
        args: [
          datasetId,
          cleanFileName,
          fileName,
          userEmail,
          finalVersion,
          data.length,
          JSON.stringify(columns),
          estimatedSize,
          nowIso,
          nowIso,
          tableName,
        ],
      }
    );

    // Ensure on-disk persistence of recent changes
    await this.conn.query('CHECKPOINT;');

    const dataset: LocalDataset = {
      id: datasetId,
      name: cleanFileName,
      rowCount: data.length,
      columns,
      createdAt: new Date(nowIso),
      updatedAt: new Date(nowIso),
      fileSize: estimatedSize,
      originalFileName: fileName,
      version: finalVersion,
      userEmail,
    };

    return dataset;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) await this.initialize();
    if (!this.conn) throw new Error('DuckDB connection not available');
  }

  private async getMetaById(datasetId: string): Promise<{
    id: string;
    name: string;
    original_file_name: string;
    user_email: string;
    version: number;
    row_count: number;
    columns: string;
    file_size: number;
    created_at: string;
    updated_at: string;
    table_name: string;
  } | null> {
    await this.ensureInitialized();
    const result = await this.conn!.query(`SELECT * FROM ${this.META_TABLE} WHERE id = ?`, { args: [datasetId] });
    const rows = result.toArray().map((r) => Object.fromEntries(r)) as any[];
    return rows[0] || null;
  }

  private async tableExists(tableName: string): Promise<boolean> {
    await this.ensureInitialized();
    try {
      await this.conn!.query(`SELECT 1 FROM "${tableName}" LIMIT 1`);
      return true;
    } catch {
      return false;
    }
  }

  private async loadDatasetIntoMemory(datasetId: string): Promise<{ dataset: LocalDataset; tableName: string }> {
    await this.ensureInitialized();
    const meta = await this.getMetaById(datasetId);
    if (!meta) throw new Error(`Dataset ${datasetId} not found`);
    const tableName = meta.table_name || this.tableNameForId(datasetId);

    const exists = await this.tableExists(tableName);
    if (!exists) throw new Error(`Table ${tableName} does not exist in DuckDB`);

    const dataset: LocalDataset = {
      id: meta.id,
      name: meta.name,
      rowCount: meta.row_count,
      columns: JSON.parse(meta.columns || '[]'),
      createdAt: new Date(meta.created_at),
      updatedAt: new Date(meta.updated_at),
      fileSize: Number(meta.file_size || 0),
      originalFileName: meta.original_file_name,
      version: Number(meta.version || 1),
      userEmail: meta.user_email,
    };

    return { dataset, tableName };
  }

  async queryDataset(datasetId: string, query: string): Promise<any[]> {
    await this.ensureInitialized();
    const { dataset, tableName } = await this.loadDatasetIntoMemory(datasetId);

    const processedQuery = query.replace(/\{table\}/g, `"${tableName}"`);
    const result = await this.conn!.query(processedQuery);
    return result.toArray().map((row) => Object.fromEntries(row));
  }

  async listDatasets(): Promise<LocalDataset[]> {
    await this.ensureInitialized();
    const result = await this.conn!.query(`SELECT * FROM ${this.META_TABLE} ORDER BY updated_at DESC`);
    const rows = result.toArray().map((r) => Object.fromEntries(r)) as any[];
    return rows.map((meta) => ({
      id: meta.id,
      name: meta.name,
      rowCount: Number(meta.row_count || 0),
      columns: JSON.parse(meta.columns || '[]'),
      createdAt: new Date(meta.created_at),
      updatedAt: new Date(meta.updated_at),
      fileSize: Number(meta.file_size || 0),
      originalFileName: meta.original_file_name,
      version: Number(meta.version || 1),
      userEmail: meta.user_email,
    }));
  }

  async checkLocalFileConflict(
    userEmail: string,
    originalFileName: string
  ): Promise<{
    exists: boolean;
    versions: Array<{ version: number; id: string; createdAt: string }>;
    nextVersion: number;
  }> {
    await this.ensureInitialized();
    const result = await this.conn!.query(
      `SELECT id, version, created_at FROM ${this.META_TABLE} WHERE user_email = ? AND original_file_name = ? ORDER BY version DESC`,
      { args: [userEmail, originalFileName] }
    );
    const rows = result.toArray().map((r) => Object.fromEntries(r)) as any[];
    const versions = rows.map((r) => ({ version: Number(r.version), id: r.id, createdAt: new Date(r.created_at).toISOString() }));
    const exists = versions.length > 0;
    const nextVersion = exists ? Math.max(...versions.map((v) => v.version)) + 1 : 1;
    return { exists, versions, nextVersion };
  }

  async getNextVersion(userEmail: string, originalFileName: string): Promise<number> {
    const conflict = await this.checkLocalFileConflict(userEmail, originalFileName);
    return conflict.nextVersion;
  }

  async getLocalFileVersions(userEmail: string, originalFileName: string): Promise<LocalDataset[]> {
    await this.ensureInitialized();
    const result = await this.conn!.query(
      `SELECT * FROM ${this.META_TABLE} WHERE user_email = ? AND original_file_name = ? ORDER BY version DESC`,
      { args: [userEmail, originalFileName] }
    );
    const rows = result.toArray().map((r) => Object.fromEntries(r)) as any[];
    return rows.map((meta) => ({
      id: meta.id,
      name: meta.name,
      rowCount: Number(meta.row_count || 0),
      columns: JSON.parse(meta.columns || '[]'),
      createdAt: new Date(meta.created_at),
      updatedAt: new Date(meta.updated_at),
      fileSize: Number(meta.file_size || 0),
      originalFileName: meta.original_file_name,
      version: Number(meta.version || 1),
      userEmail: meta.user_email,
    }));
  }

  async getLocalUserUploads(userEmail: string): Promise<LocalDataset[]> {
    await this.ensureInitialized();
    const result = await this.conn!.query(
      `SELECT * FROM ${this.META_TABLE} WHERE user_email = ? ORDER BY updated_at DESC`,
      { args: [userEmail] }
    );
    const rows = result.toArray().map((r) => Object.fromEntries(r)) as any[];
    return rows.map((meta) => ({
      id: meta.id,
      name: meta.name,
      rowCount: Number(meta.row_count || 0),
      columns: JSON.parse(meta.columns || '[]'),
      createdAt: new Date(meta.created_at),
      updatedAt: new Date(meta.updated_at),
      fileSize: Number(meta.file_size || 0),
      originalFileName: meta.original_file_name,
      version: Number(meta.version || 1),
      userEmail: meta.user_email,
    }));
  }

  async getDatasetMetadata(datasetId: string): Promise<LocalDataset | null> {
    const meta = await this.getMetaById(datasetId);
    if (!meta) return null;
    return {
      id: meta.id,
      name: meta.name,
      rowCount: Number(meta.row_count || 0),
      columns: JSON.parse(meta.columns || '[]'),
      createdAt: new Date(meta.created_at),
      updatedAt: new Date(meta.updated_at),
      fileSize: Number(meta.file_size || 0),
      originalFileName: meta.original_file_name,
      version: Number(meta.version || 1),
      userEmail: meta.user_email,
    };
  }

  async deleteDataset(datasetId: string): Promise<void> {
    await this.ensureInitialized();
    const meta = await this.getMetaById(datasetId);
    if (!meta) return;
    const tableName = meta.table_name || this.tableNameForId(datasetId);

    try {
      await this.conn!.query(`DROP TABLE IF EXISTS "${tableName}"`);
    } catch {}

    await this.conn!.query(`DELETE FROM ${this.META_TABLE} WHERE id = ?`, { args: [datasetId] });
  }

  async getStorageInfo(): Promise<{
    datasetCount: number;
    totalRows: number;
    estimatedSizeMB: number;
    loadedInMemory: number;
  }> {
    await this.ensureInitialized();
    const result = await this.conn!.query(`SELECT COUNT(*) AS cnt, SUM(row_count) AS rows, SUM(file_size) AS bytes FROM ${this.META_TABLE}`);
    const row = Object.fromEntries(result.toArray()[0] || []) as any;
    const datasetCount = Number(row.cnt || 0);
    const totalRows = Number(row.rows || 0);
    const totalBytes = Number(row.bytes || 0);
    return {
      datasetCount,
      totalRows,
      estimatedSizeMB: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
      loadedInMemory: 0,
    };
  }

  async unloadDataset(_datasetId: string): Promise<void> {
    // No-op: data stays in DuckDB persistent storage; we do not maintain separate in-memory copies
  }

  async clearMemory(): Promise<void> {
    // No-op: persistence is handled by DuckDB; no transient tables are created outside the data tables themselves
  }

  async overwriteLocalFile(
    data: DataRow[],
    fileName: string,
    columns: string[],
    userEmail: string,
    version: number
  ): Promise<LocalDataset> {
    // Delete any existing dataset with the same user/file/version, then save
    await this.ensureInitialized();
    const existing = await this.conn!.query(
      `SELECT id FROM ${this.META_TABLE} WHERE user_email = ? AND original_file_name = ? AND version = ?`,
      { args: [userEmail, fileName, version] }
    );
    const rows = existing.toArray().map((r) => Object.fromEntries(r)) as any[];
    for (const r of rows) {
      await this.deleteDataset(r.id);
    }
    return this.saveDataset(data, fileName, columns, userEmail, version);
  }

  async deleteLocalFileVersion(
    userEmail: string,
    originalFileName: string,
    version: number
  ): Promise<void> {
    await this.ensureInitialized();
    const res = await this.conn!.query(
      `SELECT id FROM ${this.META_TABLE} WHERE user_email = ? AND original_file_name = ? AND version = ?`,
      { args: [userEmail, originalFileName, version] }
    );
    const rows = res.toArray().map((r) => Object.fromEntries(r)) as any[];
    for (const r of rows) {
      await this.deleteDataset(r.id);
    }
  }

  async clearAllUserData(userEmail: string): Promise<void> {
    await this.ensureInitialized();
    const res = await this.conn!.query(
      `SELECT id FROM ${this.META_TABLE} WHERE user_email = ?`,
      { args: [userEmail] }
    );
    const rows = res.toArray().map((r) => Object.fromEntries(r)) as any[];
    for (const r of rows) {
      await this.deleteDataset(r.id);
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.conn) {
        try { await this.conn.close(); } catch {}
      }
      if (this.db) {
        try { await this.db.terminate(); } catch {}
      }
    } finally {
      this.conn = null;
      this.db = null;
      this.initialized = false;
    }
  }
}

export const duckdbService = new DuckDBService();
