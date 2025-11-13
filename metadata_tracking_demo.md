# User Upload Metadata Tracking System

## Overview
The system now maintains a comprehensive metadata table (`user_uploads_metadata`) that tracks all user file uploads alongside the actual data tables.

## Database Schema

### Metadata Table: `user_uploads_metadata`
```sql
CREATE TABLE user_uploads_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_name VARCHAR(255) NOT NULL,
  table_name VARCHAR(255) NOT NULL UNIQUE,
  original_filename VARCHAR(500) NOT NULL,
  upload_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  row_count INTEGER NOT NULL DEFAULT 0,
  column_count INTEGER NOT NULL DEFAULT 0,
  column_names TEXT,
  file_size_bytes INTEGER,
  upload_status VARCHAR(50) DEFAULT 'success',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Data Tables: `user_uploads_*`
User data continues to be stored in separate tables with the prefix `user_uploads_` followed by timestamp and filename.

## API Endpoints

### 1. Create Table with Metadata
**POST** `/api/database/tables/:tableName`
```json
{
  "data": [...],
  "overwrite": false,
  "metadata": {
    "user_name": "mail2koushikde@gmail.com",
    "original_filename": "sales_data.csv",
    "file_size_bytes": 12345
  }
}
```

### 2. Get All Upload Metadata
**GET** `/api/database/uploads`
```json
{
  "success": true,
  "uploads": [...],
  "count": 5
}
```

### 3. Get User's Uploads
**GET** `/api/database/uploads/user/:userName`
```json
{
  "success": true,
  "uploads": [...],
  "count": 3,
  "user_name": "mail2koushikde@gmail.com"
}
```

### 4. Get Table Metadata
**GET** `/api/database/tables/:tableName/metadata`
```json
{
  "success": true,
  "metadata": {
    "id": 1,
    "user_name": "mail2koushikde@gmail.com",
    "table_name": "user_uploads_1703875200000_sales_csv",
    "original_filename": "sales.csv",
    "upload_timestamp": "2024-01-01T12:00:00Z",
    "row_count": 100,
    "column_count": 5,
    "column_names": "[\"Product\",\"Sales\",\"Region\",\"Quarter\",\"Year\"]",
    "file_size_bytes": 12345,
    "upload_status": "success"
  }
}
```

### 5. Update Upload Status
**PUT** `/api/database/uploads/:tableName/status`
```json
{
  "status": "failed",
  "notes": "Data validation failed"
}
```

## Example Upload Flow

1. **User uploads CSV file**: `sales_data.csv`
2. **Data table created**: `user_uploads_1703875200000_sales_data_csv`
3. **Metadata recorded**:
   ```json
   {
     "user_name": "mail2koushikde@gmail.com",
     "table_name": "user_uploads_1703875200000_sales_data_csv",
     "original_filename": "sales_data.csv",
     "row_count": 150,
     "column_count": 4,
     "column_names": "[\"Product\",\"Sales\",\"Region\",\"Quarter\"]",
     "file_size_bytes": 8192,
     "upload_status": "success"
   }
   ```

## Benefits

1. **Complete Audit Trail**: Track who uploaded what and when
2. **File Management**: Easy identification of user-uploaded tables
3. **Metadata Search**: Find tables by user, filename, or upload date
4. **Status Tracking**: Monitor upload success/failure
5. **Resource Management**: Track file sizes and row counts
6. **Data Lineage**: Link back to original source files

## Client Integration

The file upload process now automatically:
- Generates unique table names with `user_uploads_` prefix
- Records metadata in the tracking table
- Maintains backward compatibility for visualization
- Provides enhanced error handling and status reporting

## Database Compatibility

The system works across environments:
- **SQLite** (Builder.io): Uses AUTOINCREMENT and DATETIME
- **Snowflake** (Production): Uses appropriate Snowflake data types

## Future Enhancements

- User authentication integration
- File type validation and conversion
- Automated data quality checks
- Upload quotas and limits
- Bulk operations and batch uploads
