// Database query result interface
export interface QueryResult {
  data: any[];
  columns: string[];
  rowCount: number;
}

// Database connection configuration
export interface DatabaseConfig {
  type: 'sqlite' | 'snowflake';
  // SQLite specific
  dbPath?: string;
  // Snowflake specific
  account?: string;
  username?: string;
  password?: string;
  database?: string;
  schema?: string;
  warehouse?: string;
  role?: string;
}

// Abstract database interface
export interface IDatabase {
  /**
   * Initialize database connection
   */
  init(): Promise<void>;

  /**
   * Close database connection
   */
  close(): Promise<void>;

  /**
   * Execute a raw SQL query
   */
  query(sql: string, params?: any[]): Promise<QueryResult>;

  /**
   * Get all table names
   */
  getTables(): Promise<string[]>;

  /**
   * Get table schema/columns
   */
  getTableSchema(tableName: string): Promise<string[]>;

  /**
   * Check if table exists
   */
  tableExists(tableName: string): Promise<boolean>;

  /**
   * Create table from data
   */
  createTableFromData(tableName: string, data: any[], overwrite?: boolean): Promise<void>;

  /**
   * Insert data into table
   */
  insertData(tableName: string, data: any[]): Promise<void>;

  /**
   * Get data from table with optional filtering
   */
  getTableData(tableName: string, limit?: number, offset?: number): Promise<QueryResult>;

  /**
   * Test database connection
   */
  testConnection(): Promise<boolean>;
}
