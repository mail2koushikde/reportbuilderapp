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

@app.route('/api/snowflake/test-import', methods=['POST'])
def test_import():
    """Test endpoint that returns sample data without requiring Snowflake connection"""
    try:
        data = request.get_json()
        query_type = data.get('queryType', 'table')
        query_input = data.get('query', '').strip()

        if not query_input:
            return jsonify({"error": "Query or table name is required"}), 400

        # Generate sample data based on query type
        if query_type == 'table':
            if 'sales' in query_input.lower():
                sample_data = [
                    {"Product": "Widget A", "Sales": 15000, "Region": "North", "Quarter": "Q1", "Year": 2024},
                    {"Product": "Widget B", "Sales": 22000, "Region": "South", "Quarter": "Q1", "Year": 2024},
                    {"Product": "Widget C", "Sales": 18500, "Region": "East", "Quarter": "Q1", "Year": 2024},
                    {"Product": "Widget A", "Sales": 16500, "Region": "West", "Quarter": "Q2", "Year": 2024},
                    {"Product": "Widget B", "Sales": 24000, "Region": "North", "Quarter": "Q2", "Year": 2024},
                    {"Product": "Widget C", "Sales": 19200, "Region": "South", "Quarter": "Q2", "Year": 2024},
                    {"Product": "Widget A", "Sales": 17800, "Region": "East", "Quarter": "Q3", "Year": 2024},
                    {"Product": "Widget B", "Sales": 26500, "Region": "West", "Quarter": "Q3", "Year": 2024},
                    {"Product": "Widget C", "Sales": 21000, "Region": "North", "Quarter": "Q3", "Year": 2024},
                    {"Product": "Widget A", "Sales": 19200, "Region": "South", "Quarter": "Q4", "Year": 2024}
                ]
                columns = ["Product", "Sales", "Region", "Quarter", "Year"]
            elif 'customer' in query_input.lower():
                sample_data = [
                    {"Customer_ID": 1001, "Customer_Name": "Acme Corp", "Industry": "Manufacturing", "Revenue": 250000, "City": "New York"},
                    {"Customer_ID": 1002, "Customer_Name": "Tech Solutions", "Industry": "Technology", "Revenue": 180000, "City": "San Francisco"},
                    {"Customer_ID": 1003, "Customer_Name": "Global Retail", "Industry": "Retail", "Revenue": 320000, "City": "Chicago"},
                    {"Customer_ID": 1004, "Customer_Name": "Finance Plus", "Industry": "Financial", "Revenue": 450000, "City": "Boston"},
                    {"Customer_ID": 1005, "Customer_Name": "Health Systems", "Industry": "Healthcare", "Revenue": 380000, "City": "Los Angeles"},
                    {"Customer_ID": 1006, "Customer_Name": "Energy Co", "Industry": "Energy", "Revenue": 520000, "City": "Houston"},
                    {"Customer_ID": 1007, "Customer_Name": "Food Chain", "Industry": "Food & Beverage", "Revenue": 290000, "City": "Miami"},
                    {"Customer_ID": 1008, "Customer_Name": "Auto Parts", "Industry": "Automotive", "Revenue": 210000, "City": "Detroit"}
                ]
                columns = ["Customer_ID", "Customer_Name", "Industry", "Revenue", "City"]
            else:
                # Generic financial data
                sample_data = [
                    {"Category": "Forecast", "Amount": 133203153, "Type": "Projected", "Department": "Sales"},
                    {"Category": "Actuals", "Amount": 94522006, "Type": "Actual", "Department": "Sales"},
                    {"Category": "Plan", "Amount": 21050016, "Type": "Budget", "Department": "Marketing"},
                    {"Category": "Forecast", "Amount": 45678900, "Type": "Projected", "Department": "Operations"},
                    {"Category": "Actuals", "Amount": 67890123, "Type": "Actual", "Department": "Operations"},
                    {"Category": "Plan", "Amount": 34567890, "Type": "Budget", "Department": "R&D"},
                    {"Category": "Forecast", "Amount": 23456789, "Type": "Projected", "Department": "HR"},
                    {"Category": "Actuals", "Amount": 56789012, "Type": "Actual", "Department": "Finance"}
                ]
                columns = ["Category", "Amount", "Type", "Department"]
        else:
            # For SQL queries, return aggregated sample data
            sample_data = [
                {"Product_Category": "Electronics", "Total_Sales": 567890, "Avg_Price": 299.99, "Order_Count": 1234},
                {"Product_Category": "Clothing", "Total_Sales": 432100, "Avg_Price": 89.50, "Order_Count": 2341},
                {"Product_Category": "Home & Garden", "Total_Sales": 345678, "Avg_Price": 156.75, "Order_Count": 987},
                {"Product_Category": "Sports", "Total_Sales": 234567, "Avg_Price": 124.99, "Order_Count": 1567},
                {"Product_Category": "Books", "Total_Sales": 123456, "Avg_Price": 24.99, "Order_Count": 3456}
            ]
            columns = ["Product_Category", "Total_Sales", "Avg_Price", "Order_Count"]

        logger.info(f"Test import returning {len(sample_data)} rows for query: {query_input}")

        return jsonify({
            "success": True,
            "data": sample_data,
            "columns": columns,
            "rowCount": len(sample_data),
            "query": f"TEST MODE: {query_input}",
            "isTestData": True
        })

    except Exception as e:
        logger.error(f"Test import failed: {str(e)}")
        return jsonify({"error": f"Test import failed: {str(e)}"}), 500

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
        logger.warning(f"Missing Snowflake credentials: {', '.join(missing_vars)}")
        logger.info("🧪 Starting in TEST MODE - Use /api/snowflake/test-import for sample data")
        logger.info("💡 For production: set SNOWFLAKE_USER, SNOWFLAKE_PASSWORD, SNOWFLAKE_ACCOUNT")
    else:
        logger.info("✅ Snowflake credentials found")

    logger.info("Starting Snowflake API server...")
    app.run(debug=True, host='0.0.0.0', port=5000)
