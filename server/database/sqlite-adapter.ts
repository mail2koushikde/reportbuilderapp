import sqlite3Pkg from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { IDatabase, DatabaseConfig, QueryResult } from './interface';

const { Database } = sqlite3Pkg;

export class SQLiteAdapter implements IDatabase {
  private db: Database | null = null;
  private config: DatabaseConfig;
  private dbPath: string;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.dbPath = config.dbPath || path.join(process.cwd(), 'data', 'reportbuilder.db');
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new Database(this.dbPath, (err) => {
        if (err) {
          reject(new Error(`Failed to initialize SQLite database: ${err.message}`));
          return;
        }
        console.log(`SQLite database initialized at: ${this.dbPath}`);
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          reject(new Error(`Failed to close SQLite database: ${err.message}`));
          return;
        }
        this.db = null;
        resolve();
      });
    });
  }

  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) {
          reject(new Error(`Query failed: ${err.message}`));
          return;
        }

        const data = rows || [];
        const columns = data.length > 0 ? Object.keys(data[0]) : [];
        
        resolve({
          data,
          columns,
          rowCount: data.length
        });
      });
    });
  }

  async getTables(): Promise<string[]> {
    const result = await this.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    return result.data.map(row => row.name);
  }

  async getTableSchema(tableName: string): Promise<string[]> {
    const result = await this.query(`PRAGMA table_info(${tableName})`);
    return result.data.map(row => row.name);
  }

  async tableExists(tableName: string): Promise<boolean> {
    const result = await this.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
      [tableName]
    );
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

    // Analyze data to determine column types
    const sample = data[0];
    const columns = Object.keys(sample);
    const columnDefs = columns.map(col => {
      const value = sample[col];
      let type = 'TEXT';
      
      if (typeof value === 'number') {
        type = Number.isInteger(value) ? 'INTEGER' : 'REAL';
      } else if (typeof value === 'boolean') {
        type = 'INTEGER'; // SQLite doesn't have boolean, use INTEGER
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

    // Use transaction for better performance
    await this.query('BEGIN TRANSACTION');
    
    try {
      for (const row of data) {
        const values = columns.map(col => {
          const value = row[col];
          // Convert boolean to integer for SQLite
          if (typeof value === 'boolean') {
            return value ? 1 : 0;
          }
          return value;
        });
        await this.query(sql, values);
      }
      await this.query('COMMIT');
    } catch (error) {
      await this.query('ROLLBACK');
      throw error;
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
      console.error('SQLite connection test failed:', error);
      return false;
    }
  }
}
