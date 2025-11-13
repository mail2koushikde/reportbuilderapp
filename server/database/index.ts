// Database module exports
export { IDatabase, DatabaseConfig, QueryResult } from './interface';
export { SQLiteAdapter } from './sqlite-adapter';
export { SnowflakeAdapter } from './snowflake-adapter';
export { DatabaseService, databaseService } from './database-service';

// Re-export the singleton instance for convenience
export default databaseService;
