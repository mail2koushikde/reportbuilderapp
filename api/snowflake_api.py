from flask import Flask, request, jsonify
from flask_cors import CORS
import snowflake.connector
import pandas as pd
import os
from typing import Dict, Any, List
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

class SnowflakeConnection:
    def __init__(self):
        self.connection = None
        
    def connect(self):
        """Initialize Snowflake connection using environment variables"""
        try:
            self.connection = snowflake.connector.connect(
                user=os.getenv('SNOWFLAKE_USER'),
                password=os.getenv('SNOWFLAKE_PASSWORD'),
                account=os.getenv('SNOWFLAKE_ACCOUNT'),
                warehouse=os.getenv('SNOWFLAKE_WAREHOUSE'),
                database=os.getenv('SNOWFLAKE_DATABASE'),
                schema=os.getenv('SNOWFLAKE_SCHEMA'),
                role=os.getenv('SNOWFLAKE_ROLE', 'PUBLIC')
            )
            logger.info("Successfully connected to Snowflake")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Snowflake: {str(e)}")
            return False
    
    def execute_query(self, query: str, limit: int = 1000) -> Dict[str, Any]:
        """Execute a query and return results as JSON-serializable data"""
        if not self.connection:
            if not self.connect():
                return {"error": "Failed to connect to Snowflake"}
        
        try:
            # Add LIMIT clause if not present in the query
            if limit and 'LIMIT' not in query.upper():
                query = f"{query.rstrip(';')} LIMIT {limit}"
            
            # Execute query
            cursor = self.connection.cursor()
            cursor.execute(query)
            
            # Fetch results
            results = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            
            # Convert to list of dictionaries
            data = []
            for row in results:
                row_dict = {}
                for i, value in enumerate(row):
                    # Handle different data types for JSON serialization
                    if pd.isna(value) if pd and hasattr(pd, 'isna') else value is None:
                        row_dict[columns[i]] = None
                    elif isinstance(value, (int, float, str, bool)):
                        row_dict[columns[i]] = value
                    else:
                        # Convert other types to string
                        row_dict[columns[i]] = str(value)
                data.append(row_dict)
            
            cursor.close()
            
            return {
                "success": True,
                "data": data,
                "columns": columns,
                "row_count": len(data)
            }
            
        except Exception as e:
            logger.error(f"Query execution failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def close(self):
        """Close the Snowflake connection"""
        if self.connection:
            self.connection.close()
            logger.info("Snowflake connection closed")

# Global connection instance
snowflake_conn = SnowflakeConnection()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "snowflake-api"})

@app.route('/api/snowflake/test-connection', methods=['POST'])
def test_connection():
    """Test Snowflake connection"""
    if snowflake_conn.connect():
        snowflake_conn.close()
        return jsonify({"success": True, "message": "Connection successful"})
    else:
        return jsonify({"success": False, "error": "Failed to connect to Snowflake"}), 500

@app.route('/api/snowflake/import', methods=['POST'])
def import_data():
    """Import data from Snowflake table or execute custom SQL query"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        query_type = data.get('queryType', 'table')
        query_input = data.get('query', '').strip()
        limit = data.get('limit', 1000)
        
        if not query_input:
            return jsonify({"error": "Query or table name is required"}), 400
        
        # Build the SQL query based on type
        if query_type == 'table':
            # For table name, create a SELECT * query
            # Validate table name format (basic validation)
            if not all(c.isalnum() or c in '._' for c in query_input.replace('.', '_')):
                return jsonify({"error": "Invalid table name format"}), 400
            
            sql_query = f"SELECT * FROM {query_input}"
        else:
            # For SQL query, use as-is but validate it's a SELECT statement
            if not query_input.upper().strip().startswith('SELECT'):
                return jsonify({"error": "Only SELECT queries are allowed"}), 400
            
            sql_query = query_input
        
        logger.info(f"Executing query: {sql_query[:100]}...")
        
        # Execute the query
        result = snowflake_conn.execute_query(sql_query, limit)
        
        if result.get("success"):
            return jsonify({
                "success": True,
                "data": result["data"],
                "columns": result["columns"],
                "rowCount": result["row_count"],
                "query": sql_query
            })
        else:
            return jsonify({
                "success": False,
                "error": result.get("error", "Unknown error occurred")
            }), 500
            
    except Exception as e:
        logger.error(f"Import failed: {str(e)}")
        return jsonify({"error": f"Import failed: {str(e)}"}), 500

@app.route('/api/snowflake/tables', methods=['GET'])
def list_tables():
    """List available tables in the configured database/schema"""
    try:
        query = """
        SELECT TABLE_NAME, TABLE_SCHEMA, TABLE_TYPE
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = CURRENT_SCHEMA()
        ORDER BY TABLE_NAME
        """
        
        result = snowflake_conn.execute_query(query)
        
        if result.get("success"):
            return jsonify({
                "success": True,
                "tables": result["data"]
            })
        else:
            return jsonify({
                "success": False,
                "error": result.get("error", "Failed to list tables")
            }), 500
            
    except Exception as e:
        logger.error(f"Failed to list tables: {str(e)}")
        return jsonify({"error": f"Failed to list tables: {str(e)}"}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    # Check for required environment variables
    required_vars = ['SNOWFLAKE_USER', 'SNOWFLAKE_PASSWORD', 'SNOWFLAKE_ACCOUNT']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        logger.info("Please set the following environment variables:")
        logger.info("SNOWFLAKE_USER, SNOWFLAKE_PASSWORD, SNOWFLAKE_ACCOUNT")
        logger.info("Optional: SNOWFLAKE_WAREHOUSE, SNOWFLAKE_DATABASE, SNOWFLAKE_SCHEMA, SNOWFLAKE_ROLE")
    else:
        logger.info("Starting Snowflake API server...")
        app.run(debug=True, host='0.0.0.0', port=5000)
