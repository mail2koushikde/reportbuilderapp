# Database Abstraction Layer

This module provides a unified database interface that supports both SQLite (for Builder.io/development) and Snowflake (for production) environments.

## Features

- **Environment-aware**: Automatically selects the appropriate database adapter based on environment variables
- **Unified API**: Same interface for both SQLite and Snowflake operations
- **Type-safe**: Full TypeScript support with proper typing
- **Easy switching**: Change databases without code modifications

## Architecture

```
database/
├── interface.ts          # Database interface definition
├── sqlite-adapter.ts     # SQLite implementation
├── snowflake-adapter.ts  # Snowflake implementation
├── database-service.ts   # Service layer with auto-selection
└── index.ts             # Module exports
```

## Environment Configuration

### SQLite (Builder.io/Development)
```bash
# Optional - defaults to ./data/reportbuilder.db
SQLITE_DB_PATH=./data/myapp.db
```

### Snowflake (Production)
```bash
SNOWFLAKE_ACCOUNT=your_account
SNOWFLAKE_USERNAME=your_username
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_DATABASE=REPORTBUILDER
SNOWFLAKE_SCHEMA=PUBLIC
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_ROLE=ACCOUNTADMIN
```

## Usage

### Basic Operations

```typescript
import { databaseService } from './database/database-service';

// Initialize (done automatically in server startup)
await databaseService.initialize();

// Get all tables
const tables = await databaseService.getTables();

// Query data
const result = await databaseService.query('SELECT * FROM my_table LIMIT 10');

// Create table from data
const data = [
  { name: 'John', age: 30, city: 'New York' },
  { name: 'Jane', age: 25, city: 'Boston' }
];
await databaseService.createTableFromData('users', data);

// Get table data with pagination
const tableData = await databaseService.getTableData('users', 100, 0);
```

### API Endpoints

The database functionality is exposed through REST API endpoints:

#### Health Check
```
GET /api/database/health
```

#### List Tables
```
GET /api/database/tables
```

#### Get Table Schema
```
GET /api/database/tables/:tableName/schema
```

#### Get Table Data
```
GET /api/database/tables/:tableName/data?limit=100&offset=0
```

#### Execute SQL Query
```
POST /api/database/query
{
  "sql": "SELECT * FROM my_table WHERE column = ?",
  "params": ["value"]
}
```

#### Create Table from Data
```
POST /api/database/tables/:tableName
{
  "data": [{"col1": "value1", "col2": "value2"}],
  "overwrite": false
}
```

### Legacy Snowflake API Compatibility

The existing `/api/snowflake` endpoints now use the database service internally:

- `GET /api/snowflake/health` - Health check (shows actual database type)
- `GET /api/snowflake/tables` - List tables from actual database
- `POST /api/snowflake/import` - Import data using database service
- `POST /api/snowflake/test-import` - Still provides sample data

## Database Setup

Run the setup script to initialize sample data:

```bash
npx ts-node server/scripts/setup-database.ts
```

This creates sample tables:
- `sales_data` - Sales figures by product and region
- `customer_data` - Customer information
- `financial_data` - Financial projections and actuals

## Database Selection Logic

1. **Snowflake**: Used when `SNOWFLAKE_*` environment variables are present and not in Builder.io
2. **SQLite**: Used by default, especially in Builder.io environment

## File Structure (SQLite)

When using SQLite, the database file is stored in:
- Builder.io: `./data/reportbuilder.db`
- Custom path: `SQLITE_DB_PATH` environment variable

## Production Deployment

### For Snowflake
1. Set all required `SNOWFLAKE_*` environment variables
2. Install snowflake-sdk: `npm install snowflake-sdk`
3. Update imports in `snowflake-adapter.ts`

### For Builder.io
1. Ensure `data/` directory is writable
2. SQLite database will be created automatically
3. Use the setup script to populate initial data

## Error Handling

All database operations include proper error handling:
- Connection failures
- SQL syntax errors
- Permission issues
- Invalid table names
- Data validation errors

## Security

- SQL injection protection through parameterized queries
- Table name validation (alphanumeric + underscore only)
- Read-only queries enforced in public API endpoints
- Environment-based configuration

## Dependencies

### SQLite
- `sqlite3` - SQLite database driver
- `@types/sqlite3` - TypeScript types

### Snowflake (Production)
- `snowflake-sdk` - Snowflake database driver (install separately)

## Troubleshooting

### Common Issues

1. **Database file permissions**: Ensure write access to data directory
2. **Missing dependencies**: Run `npm install` after adding database dependencies
3. **Connection timeouts**: Check network connectivity for Snowflake
4. **Table not found**: Verify table names and schema

### Debug Information

Use the health endpoint to check database status:
```bash
curl http://localhost:3000/api/database/health
```

Returns:
```json
{
  "status": "healthy",
  "service": "database-api",
  "databaseType": "sqlite",
  "config": {
    "type": "sqlite",
    "dbPath": "./data/reportbuilder.db"
  }
}
```
