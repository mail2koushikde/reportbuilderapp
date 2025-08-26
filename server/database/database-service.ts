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
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance();
