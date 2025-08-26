import { IDatabase, DatabaseConfig, QueryResult } from './interface';
import { SQLiteAdapter } from './sqlite-adapter';
import { SnowflakeAdapter } from './snowflake-adapter';

export class DatabaseService {
  private static instance: DatabaseService;
  private database: IDatabase | null = null;
  private config: DatabaseConfig;

  private constructor() {
    // Determine database type based on environment
    this.config = this.getConfigFromEnvironment();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private getConfigFromEnvironment(): DatabaseConfig {
    // Check if running in Builder.io environment
    const isBuilderEnv = process.env.NODE_ENV === 'production' && 
                        process.env.BUILDER_IO === 'true';
    
    // Check for Snowflake environment variables
    const hasSnowflakeConfig = process.env.SNOWFLAKE_ACCOUNT &&
                              process.env.SNOWFLAKE_USERNAME &&
                              process.env.SNOWFLAKE_PASSWORD;

    if (hasSnowflakeConfig && !isBuilderEnv) {
      // Use Snowflake in production with proper credentials
      return {
        type: 'snowflake',
        account: process.env.SNOWFLAKE_ACCOUNT,
        username: process.env.SNOWFLAKE_USERNAME,
        password: process.env.SNOWFLAKE_PASSWORD,
        database: process.env.SNOWFLAKE_DATABASE || 'REPORTBUILDER',
        schema: process.env.SNOWFLAKE_SCHEMA || 'PUBLIC',
        warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'COMPUTE_WH',
        role: process.env.SNOWFLAKE_ROLE || 'ACCOUNTADMIN'
      };
    } else {
      // Use SQLite for Builder.io or development
      return {
        type: 'sqlite',
        dbPath: process.env.SQLITE_DB_PATH || './data/reportbuilder.db'
      };
    }
  }

  async initialize(): Promise<void> {
    if (this.database) {
      return; // Already initialized
    }

    try {
      if (this.config.type === 'snowflake') {
        this.database = new SnowflakeAdapter(this.config);
        console.log('Using Snowflake database adapter');
      } else {
        this.database = new SQLiteAdapter(this.config);
        console.log('Using SQLite database adapter');
      }

      await this.database.init();

      // Create metadata table for tracking user uploads
      await this.initializeMetadataTable();

      console.log(`Database initialized successfully (${this.config.type})`);
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.database) {
      await this.database.close();
      this.database = null;
    }
  }

  getDatabase(): IDatabase {
    if (!this.database) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.database;
  }

  // Convenience methods that delegate to the underlying database
  async query(sql: string, params?: any[]): Promise<QueryResult> {
    return this.getDatabase().query(sql, params);
  }

  async getTables(): Promise<string[]> {
    return this.getDatabase().getTables();
  }

  async getTableSchema(tableName: string): Promise<string[]> {
    return this.getDatabase().getTableSchema(tableName);
  }

  async tableExists(tableName: string): Promise<boolean> {
    return this.getDatabase().tableExists(tableName);
  }

  async createTableFromData(tableName: string, data: any[], overwrite?: boolean): Promise<void> {
    return this.getDatabase().createTableFromData(tableName, data, overwrite);
  }

  async insertData(tableName: string, data: any[]): Promise<void> {
    return this.getDatabase().insertData(tableName, data);
  }

  async getTableData(tableName: string, limit?: number, offset?: number): Promise<QueryResult> {
    return this.getDatabase().getTableData(tableName, limit, offset);
  }

  async testConnection(): Promise<boolean> {
    return this.getDatabase().testConnection();
  }

  // Utility method to get database type
  getDatabaseType(): 'sqlite' | 'snowflake' {
    return this.config.type;
  }

  // Method to get configuration (useful for debugging)
  getConfig(): Partial<DatabaseConfig> {
    // Return config without sensitive information
    const { password, ...safeConfig } = this.config;
    return safeConfig;
  }

  // Metadata table management
  private async initializeMetadataTable(): Promise<void> {
    const metadataTableExists = await this.tableExists('user_uploads_metadata');

    if (!metadataTableExists) {
      // Create metadata table with versioning and composite primary key
      const createMetadataTableSQL = `
        CREATE TABLE user_uploads_metadata (
          user_name VARCHAR(255) NOT NULL,
          original_filename VARCHAR(500) NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          table_name VARCHAR(255) NOT NULL UNIQUE,
          upload_timestamp ${this.config.type === 'sqlite' ? 'DATETIME DEFAULT CURRENT_TIMESTAMP' : 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP()'},
          row_count INTEGER NOT NULL DEFAULT 0,
          column_count INTEGER NOT NULL DEFAULT 0,
          column_names TEXT,
          file_size_bytes INTEGER,
          upload_status VARCHAR(50) DEFAULT 'success',
          notes TEXT,
          created_at ${this.config.type === 'sqlite' ? 'DATETIME DEFAULT CURRENT_TIMESTAMP' : 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP()'},
          updated_at ${this.config.type === 'sqlite' ? 'DATETIME DEFAULT CURRENT_TIMESTAMP' : 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP()'},
          PRIMARY KEY (user_name, original_filename, version)
        )
      `;

      await this.query(createMetadataTableSQL);
      console.log('Created user_uploads_metadata table with versioning');
    }
  }

  // Check if a file already exists for a user
  async checkFileExists(user_name: string, original_filename: string): Promise<{
    exists: boolean;
    versions: Array<{ version: number; table_name: string; upload_timestamp: string }>;
    nextVersion: number;
  }> {
    const result = await this.query(
      'SELECT version, table_name, upload_timestamp FROM user_uploads_metadata WHERE user_name = ? AND original_filename = ? ORDER BY version DESC',
      [user_name, original_filename]
    );

    const exists = result.rowCount > 0;
    const versions = result.data as Array<{ version: number; table_name: string; upload_timestamp: string }>;
    const nextVersion = exists ? Math.max(...versions.map(v => v.version)) + 1 : 1;

    return { exists, versions, nextVersion };
  }

  // Insert metadata for a new upload with versioning
  async insertUploadMetadata(metadata: {
    user_name: string;
    table_name: string;
    original_filename: string;
    version: number;
    row_count: number;
    column_count: number;
    column_names: string[];
    file_size_bytes?: number;
    upload_status?: 'success' | 'failed' | 'processing';
    notes?: string;
  }): Promise<void> {
    const {
      user_name,
      table_name,
      original_filename,
      version,
      row_count,
      column_count,
      column_names,
      file_size_bytes = 0,
      upload_status = 'success',
      notes = ''
    } = metadata;

    const columnNamesJson = JSON.stringify(column_names);

    const insertSQL = `
      INSERT INTO user_uploads_metadata
      (user_name, original_filename, version, table_name, row_count, column_count, column_names, file_size_bytes, upload_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.query(insertSQL, [
      user_name,
      original_filename,
      version,
      table_name,
      row_count,
      column_count,
      columnNamesJson,
      file_size_bytes,
      upload_status,
      notes
    ]);
  }

  // Get all upload metadata
  async getAllUploadMetadata(): Promise<QueryResult> {
    return this.query('SELECT * FROM user_uploads_metadata ORDER BY upload_timestamp DESC');
  }

  // Get uploads for a specific user
  async getUserUploadMetadata(user_name: string): Promise<QueryResult> {
    return this.query(
      'SELECT * FROM user_uploads_metadata WHERE user_name = ? ORDER BY upload_timestamp DESC',
      [user_name]
    );
  }

  // Get metadata for a specific table
  async getTableMetadata(table_name: string): Promise<QueryResult> {
    return this.query(
      'SELECT * FROM user_uploads_metadata WHERE table_name = ?',
      [table_name]
    );
  }

  // Get metadata for a specific file version
  async getFileMetadata(user_name: string, original_filename: string, version?: number): Promise<QueryResult> {
    if (version) {
      return this.query(
        'SELECT * FROM user_uploads_metadata WHERE user_name = ? AND original_filename = ? AND version = ?',
        [user_name, original_filename, version]
      );
    } else {
      return this.query(
        'SELECT * FROM user_uploads_metadata WHERE user_name = ? AND original_filename = ? ORDER BY version DESC',
        [user_name, original_filename]
      );
    }
  }

  // Update upload status
  async updateUploadStatus(table_name: string, status: 'success' | 'failed' | 'processing', notes?: string): Promise<void> {
    const updateSQL = notes
      ? 'UPDATE user_uploads_metadata SET upload_status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE table_name = ?'
      : 'UPDATE user_uploads_metadata SET upload_status = ?, updated_at = CURRENT_TIMESTAMP WHERE table_name = ?';

    const params = notes ? [status, notes, table_name] : [status, table_name];
    await this.query(updateSQL, params);
  }

  // Update upload status by user and filename
  async updateUploadStatusByFile(user_name: string, original_filename: string, version: number, status: 'success' | 'failed' | 'processing', notes?: string): Promise<void> {
    const updateSQL = notes
      ? 'UPDATE user_uploads_metadata SET upload_status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE user_name = ? AND original_filename = ? AND version = ?'
      : 'UPDATE user_uploads_metadata SET upload_status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_name = ? AND original_filename = ? AND version = ?';

    const params = notes ? [status, notes, user_name, original_filename, version] : [status, user_name, original_filename, version];
    await this.query(updateSQL, params);
  }

  // Delete metadata (when table is dropped)
  async deleteUploadMetadata(table_name: string): Promise<void> {
    await this.query('DELETE FROM user_uploads_metadata WHERE table_name = ?', [table_name]);
  }

  // Delete specific version metadata
  async deleteFileMetadata(user_name: string, original_filename: string, version?: number): Promise<void> {
    if (version) {
      await this.query('DELETE FROM user_uploads_metadata WHERE user_name = ? AND original_filename = ? AND version = ?', [user_name, original_filename, version]);
    } else {
      await this.query('DELETE FROM user_uploads_metadata WHERE user_name = ? AND original_filename = ?', [user_name, original_filename]);
    }
  }

  // Create data table with metadata tracking and versioning
  async createUserDataTable(
    tableName: string,
    data: any[],
    metadata: {
      user_name: string;
      original_filename: string;
      version: number;
      file_size_bytes?: number;
    },
    overwrite?: boolean
  ): Promise<void> {
    // Create the actual data table
    await this.createTableFromData(tableName, data, overwrite);

    // Insert metadata with version
    await this.insertUploadMetadata({
      user_name: metadata.user_name,
      table_name: tableName,
      original_filename: metadata.original_filename,
      version: metadata.version,
      row_count: data.length,
      column_count: Object.keys(data[0]).length,
      column_names: Object.keys(data[0]),
      file_size_bytes: metadata.file_size_bytes || 0,
      upload_status: 'success'
    });
  }

  // Generate versioned table name
  generateVersionedTableName(original_filename: string, version: number, timestamp: number): string {
    const sanitizedFileName = original_filename.replace(/[^a-zA-Z0-9]/g, '_').replace(/\.csv$/i, '');
    return `user_uploads_${timestamp}_${sanitizedFileName}_v${version}`;
  }

  // Generate display name with version
  generateVersionedDisplayName(original_filename: string, version: number): string {
    const nameWithoutExt = original_filename.replace(/\.csv$/i, '');
    return version > 1 ? `${nameWithoutExt} (v${version})` : nameWithoutExt;
  }
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance();
