// Note: In production, install snowflake-sdk: npm install snowflake-sdk
import { IDatabase, DatabaseConfig, QueryResult } from './interface';

// Mock interface for Snowflake connection (replace with actual snowflake-sdk imports in production)
interface SnowflakeConnection {
  execute(options: { sqlText: string; binds?: any[] }): Promise<any>;
  destroy(): Promise<void>;
}

export class SnowflakeAdapter implements IDatabase {
  private connection: SnowflakeConnection | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    try {
      // In production, replace with actual snowflake-sdk implementation
      // const snowflake = require('snowflake-sdk');
      // this.connection = snowflake.createConnection({
      //   account: this.config.account,
      //   username: this.config.username,
      //   password: this.config.password,
      //   database: this.config.database,
      //   schema: this.config.schema,
      //   warehouse: this.config.warehouse,
      //   role: this.config.role,
      // });
      // await this.connection.connect();
      
      // For now, create a mock connection
      this.connection = {
        execute: async (options) => {
          throw new Error('Snowflake adapter not implemented - use SQLite adapter for Builder.io environment');
        },
        destroy: async () => {}
      };
      
      console.log('Snowflake adapter initialized (mock)');
    } catch (error) {
      throw new Error(`Failed to initialize Snowflake connection: ${error}`);
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.destroy();
      this.connection = null;
    }
  }

  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    if (!this.connection) {
      throw new Error('Snowflake connection not initialized');
    }

    try {
      const result = await this.connection.execute({
        sqlText: sql,
        binds: params
      });

      // Transform Snowflake result to our standard format
      return {
        data: result.rows || [],
        columns: result.columns?.map((col: any) => col.name) || [],
        rowCount: result.rows?.length || 0
      };
    } catch (error) {
      throw new Error(`Snowflake query failed: ${error}`);
    }
  }

  async getTables(): Promise<string[]> {
    const result = await this.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = '${this.config.schema || 'PUBLIC'}'
      AND TABLE_TYPE = 'BASE TABLE'
    `);
    return result.data.map(row => row.TABLE_NAME);
  }

  async getTableSchema(tableName: string): Promise<string[]> {
    const result = await this.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '${this.config.schema || 'PUBLIC'}'
      AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [tableName.toUpperCase()]);
    return result.data.map(row => row.COLUMN_NAME);
  }

  async tableExists(tableName: string): Promise<boolean> {
    const result = await this.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = '${this.config.schema || 'PUBLIC'}'
      AND TABLE_NAME = ?
    `, [tableName.toUpperCase()]);
    return result.data.length > 0;
  }

  async createTableFromData(tableName: string, data: any[], overwrite: boolean = false): Promise<void> {
    if (!data || data.length === 0) {
      throw new Error('No data provided to create table');
    }

    // Drop table if overwrite is requested
    if (overwrite) {
      await this.query(`DROP TABLE IF EXISTS ${tableName}`);
    }

    // Analyze data to determine Snowflake column types
    const sample = data[0];
    const columns = Object.keys(sample);
    const columnDefs = columns.map(col => {
      const value = sample[col];
      let type = 'VARCHAR(255)';
      
      if (typeof value === 'number') {
        type = Number.isInteger(value) ? 'INTEGER' : 'FLOAT';
      } else if (typeof value === 'boolean') {
        type = 'BOOLEAN';
      } else if (value instanceof Date) {
        type = 'TIMESTAMP';
      }
      
      return `${col} ${type}`;
    }).join(', ');

    // Create table
    await this.query(`CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefs})`);

    // Insert data
    await this.insertData(tableName, data);
  }

  async insertData(tableName: string, data: any[]): Promise<void> {
    if (!data || data.length === 0) return;

    const columns = Object.keys(data[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

    // Snowflake supports batch inserts
    for (const row of data) {
      const values = columns.map(col => row[col]);
      await this.query(sql, values);
    }
  }

  async getTableData(tableName: string, limit?: number, offset?: number): Promise<QueryResult> {
    let sql = `SELECT * FROM ${tableName}`;
    const params: any[] = [];

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
      
      if (offset) {
        sql += ' OFFSET ?';
        params.push(offset);
      }
    }

    return this.query(sql, params);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Snowflake connection test failed:', error);
      return false;
    }
  }
}
