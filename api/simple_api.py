#!/usr/bin/env python3
"""
Simplified Snowflake API that runs without external dependencies
Uses only Python standard library
"""

import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SnowflakeAPIHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/health':
            self.send_json_response({"status": "healthy", "service": "snowflake-api"})
        else:
            self.send_error(404, "Endpoint not found")

    def do_POST(self):
        """Handle POST requests"""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/snowflake/test-import':
            self.handle_test_import()
        elif parsed_path.path == '/api/snowflake/import':
            self.handle_production_import()
        else:
            self.send_error(404, "Endpoint not found")

    def handle_test_import(self):
        """Handle test import with sample data"""
        try:
            # Read request body
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                body = self.rfile.read(content_length)
                data = json.loads(body.decode('utf-8'))
            else:
                data = {}
            
            query_type = data.get('queryType', 'table')
            query_input = data.get('query', '').strip()
            
            if not query_input:
                self.send_json_response({"error": "Query or table name is required"}, 400)
                return
            
            # Generate sample data based on query type
            sample_data, columns = self.get_sample_data(query_type, query_input)
            
            logger.info(f"Test import returning {len(sample_data)} rows for query: {query_input}")
            
            response_data = {
                "success": True,
                "data": sample_data,
                "columns": columns,
                "rowCount": len(sample_data),
                "query": f"TEST MODE: {query_input}",
                "isTestData": True
            }
            
            self.send_json_response(response_data)
            
        except Exception as e:
            logger.error(f"Test import failed: {str(e)}")
            self.send_json_response({"error": f"Test import failed: {str(e)}"}, 500)

    def handle_production_import(self):
        """Handle production import (placeholder)"""
        self.send_json_response({
            "success": False,
            "error": "Production Snowflake import requires proper setup. Use test mode instead."
        }, 501)

    def get_sample_data(self, query_type, query_input):
        """Generate sample data based on query input"""
        query_lower = query_input.lower()
        
        if query_type == 'table':
            if 'sales' in query_lower:
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
            elif 'customer' in query_lower:
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
                # Generic financial data (matches your existing chart structure)
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
        
        return sample_data, columns

    def send_json_response(self, data, status_code=200):
        """Send JSON response with CORS headers"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        response_body = json.dumps(data, indent=2)
        self.wfile.write(response_body.encode('utf-8'))

    def log_message(self, format, *args):
        """Override to use our logger"""
        logger.info(f"{self.address_string()} - {format % args}")

def run_server(port=5000):
    """Run the HTTP server"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, SnowflakeAPIHandler)
    
    logger.info(f"🚀 Starting Snowflake API server on port {port}")
    logger.info(f"🧪 Test mode enabled - no external dependencies required")
    logger.info(f"📡 Health check: http://localhost:{port}/health")
    logger.info(f"🔗 Test import: http://localhost:{port}/api/snowflake/test-import")
    logger.info("Press Ctrl+C to stop the server")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("🛑 Shutting down server...")
        httpd.shutdown()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    run_server(port)
