# File Upload Versioning System - Complete Implementation

## Overview
The system now implements a comprehensive file versioning solution with composite primary keys and user-friendly conflict resolution.

## Database Schema Changes

### Updated Metadata Table: `user_uploads_metadata`
```sql
CREATE TABLE user_uploads_metadata (
  user_name VARCHAR(255) NOT NULL,
  original_filename VARCHAR(500) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  table_name VARCHAR(255) NOT NULL UNIQUE,
  upload_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  row_count INTEGER NOT NULL DEFAULT 0,
  column_count INTEGER NOT NULL DEFAULT 0,
  column_names TEXT,
  file_size_bytes INTEGER,
  upload_status VARCHAR(50) DEFAULT 'success',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_name, original_filename, version)
);
```

**Key Changes:**
- **Composite Primary Key**: `(user_name, original_filename, version)`
- **Version Field**: Tracks version numbers starting from 1
- **Unique Table Names**: Each version gets its own unique table

## Data Table Naming Convention

### Versioned Table Names
- **Format**: `user_uploads_<timestamp>_<sanitized_filename>_v<version>`
- **Example**: `user_uploads_1703875200000_sales_data_csv_v2`

### Display Names
- **Version 1**: `sales_data.csv` 
- **Version 2+**: `sales_data (v2).csv`

## API Endpoints

### 1. Check File Conflicts
**POST** `/api/database/uploads/check-conflict`
```json
{
  "user_name": "mail2koushikde@gmail.com",
  "original_filename": "sales_data.csv"
}
```

**Response:**
```json
{
  "success": true,
  "conflict": true,
  "existing_versions": [
    {"version": 1, "table_name": "user_uploads_1703875200000_sales_data_csv_v1", "upload_timestamp": "2024-01-01T12:00:00Z"},
    {"version": 2, "table_name": "user_uploads_1703875300000_sales_data_csv_v2", "upload_timestamp": "2024-01-01T13:00:00Z"}
  ],
  "next_version": 3
}
```

### 2. Create Versioned Table
**POST** `/api/database/tables/:tableName`
```json
{
  "data": [...],
  "overwrite": false,
  "metadata": {
    "user_name": "mail2koushikde@gmail.com",
    "original_filename": "sales_data.csv",
    "version": 3,
    "file_size_bytes": 12345
  }
}
```

### 3. Get File Versions
**GET** `/api/database/uploads/file/:userName/:filename/versions`

**Response:**
```json
{
  "success": true,
  "user_name": "mail2koushikde@gmail.com",
  "original_filename": "sales_data.csv",
  "versions": [
    {
      "version": 1,
      "table_name": "user_uploads_1703875200000_sales_data_csv_v1",
      "display_name": "sales_data",
      "upload_timestamp": "2024-01-01T12:00:00Z",
      "row_count": 100
    },
    {
      "version": 2,
      "table_name": "user_uploads_1703875300000_sales_data_csv_v2",
      "display_name": "sales_data (v2)",
      "upload_timestamp": "2024-01-01T13:00:00Z",
      "row_count": 150
    }
  ],
  "total_versions": 2,
  "latest_version": 2
}
```

## Client-Side Implementation

### Upload Flow
1. **File Selection**: User selects CSV file
2. **Conflict Check**: System checks if filename already exists
3. **Version Dialog**: If conflict exists, show options:
   - **Overwrite**: Replace latest version (destructive)
   - **New Version**: Create v3, v4, etc. (preserves history)
   - **Cancel**: Abort upload

### Version Dialog Features
- Shows all existing versions with upload dates
- Clear warning about overwrite being destructive
- Recommends new version as safer option
- Color-coded options (red for overwrite, green for new version)

## Example Upload Scenarios

### Scenario 1: First Upload
```
User uploads "sales_data.csv" → Creates v1
- Table: user_uploads_1703875200000_sales_data_csv_v1
- Display: "sales_data.csv"
- Metadata: version=1
```

### Scenario 2: Second Upload (New Version)
```
User uploads "sales_data.csv" again → Conflict detected
User chooses "New Version" → Creates v2
- Table: user_uploads_1703875300000_sales_data_csv_v2  
- Display: "sales_data (v2).csv"
- Metadata: version=2
```

### Scenario 3: Overwrite
```
User uploads "sales_data.csv" again → Conflict detected
User chooses "Overwrite v2" → Replaces v2
- Table: user_uploads_1703875300000_sales_data_csv_v2 (overwritten)
- Display: "sales_data (v2).csv"  
- Metadata: version=2, updated timestamp
```

## Database Service Methods

### New Versioning Methods
```typescript
// Check if file exists and get version info
checkFileExists(user_name: string, original_filename: string): Promise<{
  exists: boolean;
  versions: Array<{version: number; table_name: string; upload_timestamp: string}>;
  nextVersion: number;
}>

// Create user data table with versioning
createUserDataTable(tableName: string, data: any[], metadata: {
  user_name: string;
  original_filename: string; 
  version: number;
  file_size_bytes?: number;
}, overwrite?: boolean): Promise<void>

// Generate versioned table and display names
generateVersionedTableName(original_filename: string, version: number, timestamp: number): string
generateVersionedDisplayName(original_filename: string, version: number): string
```

## Benefits of This Implementation

1. **Complete Version History**: Never lose previous data versions
2. **User Choice**: Clear options for overwrite vs new version
3. **Data Safety**: Overwrite requires explicit user confirmation
4. **Easy Identification**: Version numbers in display names
5. **Scalable**: Supports unlimited versions per file
6. **Audit Trail**: Complete tracking of who uploaded what when
7. **Database Agnostic**: Works with SQLite and Snowflake

## Error Handling

- **Conflict Detection**: Graceful handling of database check failures
- **Upload Failures**: Fallback to local data loading with warnings
- **Version Conflicts**: Prevention of duplicate version creation
- **User Cancellation**: Clean abort without side effects

## UI/UX Features

- **Visual Conflict Dialog**: Clear, color-coded options
- **Version History**: Shows all existing versions with dates
- **Progress Indication**: Upload status and success messages
- **Filename Display**: Shows version numbers in success messages
- **Recommended Actions**: Guides users toward safer choices

This implementation provides a robust, user-friendly versioning system that maintains data integrity while giving users full control over their file management workflow.
