# Snowflake Data Import API

A Flask-based API for importing data from Snowflake into your dashboard application.

## Setup

### 1. Install Dependencies

```bash
cd api
pip install -r requirements.txt
```

### 2. Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` with your Snowflake credentials:
```env
SNOWFLAKE_USER=your_username
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_ACCOUNT=your_account_identifier
SNOWFLAKE_WAREHOUSE=your_warehouse
SNOWFLAKE_DATABASE=your_database
SNOWFLAKE_SCHEMA=your_schema
SNOWFLAKE_ROLE=your_role
```

### 3. Start the API Server

```bash
python snowflake_api.py
```

The API will be available at `http://localhost:5000`

## API Endpoints

### Health Check
- **GET** `/health` - Check if the API is running

### Test Connection
- **POST** `/api/snowflake/test-connection` - Test Snowflake connection

### Import Data
- **POST** `/api/snowflake/import` - Import data from Snowflake

**Request Body:**
```json
{
  "queryType": "table",  // "table" or "sql"
  "query": "DATABASE.SCHEMA.TABLE_NAME",  // table name or SQL query
  "limit": 1000  // optional, defaults to 1000
}
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "columns": [...],
  "rowCount": 123,
  "query": "SELECT * FROM ..."
}
```

### List Tables
- **GET** `/api/snowflake/tables` - List available tables in the configured schema

## Usage Examples

### Import from Table
```bash
curl -X POST http://localhost:5000/api/snowflake/import \
  -H "Content-Type: application/json" \
  -d '{
    "queryType": "table",
    "query": "DEMO_DB.PUBLIC.SALES_DATA"
  }'
```

### Import with Custom SQL
```bash
curl -X POST http://localhost:5000/api/snowflake/import \
  -H "Content-Type: application/json" \
  -d '{
    "queryType": "sql",
    "query": "SELECT product, SUM(sales) FROM DEMO_DB.PUBLIC.SALES_DATA GROUP BY product"
  }'
```

## Frontend Integration

The frontend automatically calls this API when you:
1. Click the Snowflake import button (database icon)
2. Enter a table name or SQL query
3. Click "Import Data"

The imported data will be available for creating charts just like uploaded CSV files.

## Error Handling

- Connection errors: Check your Snowflake credentials
- Query errors: Validate your SQL syntax
- Network errors: Ensure the API server is running

## Security Notes

- This API is designed for development/internal use
- In production, implement proper authentication
- Use environment variables for sensitive credentials
- Consider using Snowflake key-pair authentication for enhanced security
