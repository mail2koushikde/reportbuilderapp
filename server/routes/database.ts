import { Request, Response, Router } from "express";
import { databaseService } from "../database/database-service";

const router = Router();

// Health check endpoint
router.get("/health", async (_req: Request, res: Response) => {
  try {
    const isHealthy = await databaseService.testConnection();
    const dbType = databaseService.getDatabaseType();
    const config = databaseService.getConfig();
    
    res.json({ 
      status: isHealthy ? "healthy" : "unhealthy", 
      service: "database-api",
      databaseType: dbType,
      config: config
    });
  } catch (error) {
    res.status(500).json({ 
      status: "error", 
      service: "database-api", 
      error: String(error) 
    });
  }
});

// Get all tables
router.get("/tables", async (_req: Request, res: Response) => {
  try {
    const tables = await databaseService.getTables();
    res.json({
      success: true,
      tables: tables.map(name => ({ 
        TABLE_NAME: name, 
        TABLE_SCHEMA: "PUBLIC", 
        TABLE_TYPE: "TABLE" 
      }))
    });
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to fetch tables: ${error}` 
    });
  }
});

// Get table schema
router.get("/tables/:tableName/schema", async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;
    const columns = await databaseService.getTableSchema(tableName);
    res.json({
      success: true,
      columns: columns
    });
  } catch (error) {
    console.error('Error fetching table schema:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to fetch table schema: ${error}` 
    });
  }
});

// Get table data
router.get("/tables/:tableName/data", async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 1000;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    
    const result = await databaseService.getTableData(tableName, limit, offset);
    
    res.json({
      success: true,
      data: result.data,
      columns: result.columns,
      rowCount: result.rowCount,
      query: `SELECT * FROM ${tableName}`,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching table data:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to fetch table data: ${error}` 
    });
  }
});

// Execute custom SQL query
router.post("/query", async (req: Request, res: Response) => {
  try {
    const { sql, params } = req.body;
    
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: "SQL query is required" 
      });
    }
    
    // Basic security check - only allow SELECT statements for now
    const trimmedSql = sql.trim().toLowerCase();
    if (!trimmedSql.startsWith('select')) {
      return res.status(400).json({ 
        success: false, 
        error: "Only SELECT queries are allowed" 
      });
    }
    
    const result = await databaseService.query(sql, params);
    
    res.json({
      success: true,
      data: result.data,
      columns: result.columns,
      rowCount: result.rowCount,
      query: sql
    });
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).json({ 
      success: false, 
      error: `Query execution failed: ${error}` 
    });
  }
});

// Check for file conflicts before upload
router.post("/uploads/check-conflict", async (req: Request, res: Response) => {
  try {
    const { user_name, original_filename } = req.body;

    if (!user_name || !original_filename) {
      return res.status(400).json({
        success: false,
        error: "user_name and original_filename are required"
      });
    }

    const conflictInfo = await databaseService.checkFileExists(user_name, original_filename);

    res.json({
      success: true,
      conflict: conflictInfo.exists,
      user_name,
      original_filename,
      existing_versions: conflictInfo.versions,
      next_version: conflictInfo.nextVersion,
      suggested_action: conflictInfo.exists ? 'ask_user' : 'proceed'
    });
  } catch (error) {
    console.error('Error checking file conflict:', error);
    res.status(500).json({
      success: false,
      error: `Failed to check file conflict: ${error}`
    });
  }
});

// Create table from uploaded data
router.post("/tables/:tableName", async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;
    const { data, overwrite = false, metadata } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Data array is required and cannot be empty"
      });
    }

    // Validate table name (basic sanitization)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return res.status(400).json({
        success: false,
        error: "Invalid table name. Use only letters, numbers, and underscores."
      });
    }

    // Check if this is a user upload (has metadata) vs system table
    if (metadata && metadata.user_name && metadata.original_filename) {
      // Validate user upload metadata
      if (!metadata.user_name.trim()) {
        return res.status(400).json({
          success: false,
          error: "User name is required for user uploads"
        });
      }

      // Validate version is provided for user uploads
      if (!metadata.version || metadata.version < 1) {
        return res.status(400).json({
          success: false,
          error: "Version number is required and must be >= 1 for user uploads"
        });
      }

      // Check if this exact version already exists (to prevent duplicates)
      const existingFile = await databaseService.getFileMetadata(metadata.user_name, metadata.original_filename, metadata.version);
      if (existingFile.rowCount > 0 && !overwrite) {
        // Get all versions of this file for proper conflict resolution
        const allVersions = await databaseService.getFileMetadata(metadata.user_name, metadata.original_filename);
        const existingVersions = allVersions.data.map((v: any) => ({
          version: v.version,
          upload_timestamp: v.upload_timestamp,
          table_name: v.table_name
        }));
        const nextVersion = existingVersions.length > 0
          ? Math.max(...existingVersions.map(v => v.version)) + 1
          : 1;

        return res.status(409).json({
          success: false,
          error: `Version ${metadata.version} of file '${metadata.original_filename}' already exists for user '${metadata.user_name}'`,
          constraint_violation: true,
          existing_versions: existingVersions,
          next_version: nextVersion,
          user_name: metadata.user_name,
          original_filename: metadata.original_filename
        });
      }

      // Use the enhanced method that tracks metadata with versioning
      await databaseService.createUserDataTable(tableName, data, metadata, overwrite);
    } else {
      // Regular table creation (for system tables, etc.)
      await databaseService.createTableFromData(tableName, data, overwrite);
    }

    res.json({
      success: true,
      message: `Table '${tableName}' created successfully`,
      tableName,
      rowCount: data.length,
      columns: Object.keys(data[0]),
      ...(metadata && {
        metadata: {
          tracked: true,
          user_name: metadata.user_name,
          original_filename: metadata.original_filename,
          version: metadata.version,
          display_name: databaseService.generateVersionedDisplayName(metadata.original_filename, metadata.version)
        }
      })
    });
  } catch (error) {
    console.error('Error creating table:', error);

    // Handle specific constraint violations
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = error.message as string;

      if (errorMessage.includes('UNIQUE constraint failed: user_uploads_metadata')) {
        return res.status(409).json({
          success: false,
          error: `A file with this name and version already exists. Please use overwrite option or create a new version.`,
          constraint_violation: true
        });
      }
    }

    res.status(500).json({
      success: false,
      error: `Failed to create table: ${error}`
    });
  }
});

// Insert data into existing table
router.post("/tables/:tableName/data", async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;
    const { data } = req.body;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Data array is required and cannot be empty" 
      });
    }
    
    // Check if table exists
    const exists = await databaseService.tableExists(tableName);
    if (!exists) {
      return res.status(404).json({ 
        success: false, 
        error: `Table '${tableName}' does not exist` 
      });
    }
    
    await databaseService.insertData(tableName, data);
    
    res.json({
      success: true,
      message: `Data inserted into '${tableName}' successfully`,
      rowCount: data.length
    });
  } catch (error) {
    console.error('Error inserting data:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to insert data: ${error}` 
    });
  }
});

// Check if table exists
router.get("/tables/:tableName/exists", async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;
    const exists = await databaseService.tableExists(tableName);
    
    res.json({
      success: true,
      exists,
      tableName
    });
  } catch (error) {
    console.error('Error checking table existence:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to check table existence: ${error}` 
    });
  }
});

// Get all upload metadata
router.get("/uploads", async (_req: Request, res: Response) => {
  try {
    const result = await databaseService.getAllUploadMetadata();
    res.json({
      success: true,
      uploads: result.data,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error fetching upload metadata:', error);
    res.status(500).json({
      success: false,
      error: `Failed to fetch upload metadata: ${error}`
    });
  }
});

// Get uploads for a specific user
router.get("/uploads/user/:userName", async (req: Request, res: Response) => {
  try {
    const { userName } = req.params;
    const result = await databaseService.getUserUploadMetadata(userName);
    res.json({
      success: true,
      uploads: result.data,
      count: result.rowCount,
      user_name: userName
    });
  } catch (error) {
    console.error('Error fetching user upload metadata:', error);
    res.status(500).json({
      success: false,
      error: `Failed to fetch user upload metadata: ${error}`
    });
  }
});

// Get all versions of a specific file
router.get("/uploads/file/:userName/:filename/versions", async (req: Request, res: Response) => {
  try {
    const { userName, filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);

    const result = await databaseService.getFileMetadata(userName, decodedFilename);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: `No versions found for file '${decodedFilename}' by user '${userName}'`
      });
    }

    // Add display names to each version
    const versionsWithDisplayNames = result.data.map((version: any) => ({
      ...version,
      display_name: databaseService.generateVersionedDisplayName(version.original_filename, version.version)
    }));

    res.json({
      success: true,
      user_name: userName,
      original_filename: decodedFilename,
      versions: versionsWithDisplayNames,
      total_versions: result.rowCount,
      latest_version: Math.max(...result.data.map((v: any) => v.version))
    });
  } catch (error) {
    console.error('Error fetching file versions:', error);
    res.status(500).json({
      success: false,
      error: `Failed to fetch file versions: ${error}`
    });
  }
});

// Get metadata for a specific table
router.get("/tables/:tableName/metadata", async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;
    const result = await databaseService.getTableMetadata(tableName);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: `No metadata found for table '${tableName}'`
      });
    }

    res.json({
      success: true,
      metadata: result.data[0],
      tableName
    });
  } catch (error) {
    console.error('Error fetching table metadata:', error);
    res.status(500).json({
      success: false,
      error: `Failed to fetch table metadata: ${error}`
    });
  }
});

// Update upload status
router.put("/uploads/:tableName/status", async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;
    const { status, notes } = req.body;

    if (!['success', 'failed', 'processing'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Status must be 'success', 'failed', or 'processing'"
      });
    }

    await databaseService.updateUploadStatus(tableName, status, notes);

    res.json({
      success: true,
      message: `Upload status updated for table '${tableName}'`,
      tableName,
      status,
      ...(notes && { notes })
    });
  } catch (error) {
    console.error('Error updating upload status:', error);
    res.status(500).json({
      success: false,
      error: `Failed to update upload status: ${error}`
    });
  }
});

// Delete a specific table
router.delete("/tables/:tableName", async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;

    // Validate table name (basic sanitization)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return res.status(400).json({
        success: false,
        error: "Invalid table name. Use only letters, numbers, and underscores."
      });
    }

    // Check if table exists
    const exists = await databaseService.tableExists(tableName);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: `Table '${tableName}' does not exist`
      });
    }

    // Drop the table
    await databaseService.query(`DROP TABLE IF EXISTS ${tableName}`);

    // Delete associated metadata
    await databaseService.deleteUploadMetadata(tableName);

    res.json({
      success: true,
      message: `Table '${tableName}' deleted successfully`,
      tableName
    });
  } catch (error) {
    console.error('Error deleting table:', error);
    res.status(500).json({
      success: false,
      error: `Failed to delete table: ${error}`
    });
  }
});

// Delete all user uploads for a specific user
router.delete("/uploads/user/:userName", async (req: Request, res: Response) => {
  try {
    const { userName } = req.params;

    // Get all uploads for this user
    const userUploads = await databaseService.getUserUploadMetadata(userName);

    if (userUploads.rowCount === 0) {
      return res.json({
        success: true,
        message: `No uploads found for user '${userName}'`,
        deletedTables: [],
        deletedCount: 0
      });
    }

    const deletedTables = [];

    // Delete each table and its metadata
    for (const upload of userUploads.data) {
      try {
        // Drop the table
        await databaseService.query(`DROP TABLE IF EXISTS ${upload.table_name}`);
        deletedTables.push(upload.table_name);
        console.log(`Deleted table: ${upload.table_name}`);
      } catch (error) {
        console.error(`Failed to delete table ${upload.table_name}:`, error);
      }
    }

    // Delete all metadata for this user
    await databaseService.query('DELETE FROM user_uploads_metadata WHERE user_name = ?', [userName]);

    res.json({
      success: true,
      message: `All uploads for user '${userName}' deleted successfully`,
      deletedTables,
      deletedCount: deletedTables.length,
      user_name: userName
    });
  } catch (error) {
    console.error('Error deleting user uploads:', error);
    res.status(500).json({
      success: false,
      error: `Failed to delete user uploads: ${error}`
    });
  }
});

// Clear ALL data (admin function)
router.delete("/clear-all", async (req: Request, res: Response) => {
  try {
    // Get all upload metadata
    const allUploads = await databaseService.getAllUploadMetadata();

    const deletedTables = [];

    // Delete each user table
    for (const upload of allUploads.data) {
      try {
        await databaseService.query(`DROP TABLE IF EXISTS ${upload.table_name}`);
        deletedTables.push(upload.table_name);
        console.log(`Deleted table: ${upload.table_name}`);
      } catch (error) {
        console.error(`Failed to delete table ${upload.table_name}:`, error);
      }
    }

    // Clear all metadata
    await databaseService.query('DELETE FROM user_uploads_metadata');

    res.json({
      success: true,
      message: 'All data cleared successfully',
      deletedTables,
      deletedCount: deletedTables.length
    });
  } catch (error) {
    console.error('Error clearing all data:', error);
    res.status(500).json({
      success: false,
      error: `Failed to clear all data: ${error}`
    });
  }
});

export default router;
