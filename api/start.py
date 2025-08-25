#!/usr/bin/env python3
"""
Startup script for Snowflake API with environment variable loading
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import and run the Flask app
from snowflake_api import app, logger

if __name__ == '__main__':
    # Check for required environment variables
    required_vars = ['SNOWFLAKE_USER', 'SNOWFLAKE_PASSWORD', 'SNOWFLAKE_ACCOUNT']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        logger.info("Please create a .env file based on .env.example with your Snowflake credentials")
        sys.exit(1)
    
    logger.info("Starting Snowflake API server...")
    logger.info(f"Snowflake Account: {os.getenv('SNOWFLAKE_ACCOUNT')}")
    logger.info(f"Snowflake User: {os.getenv('SNOWFLAKE_USER')}")
    logger.info(f"Snowflake Database: {os.getenv('SNOWFLAKE_DATABASE', 'Not specified')}")
    logger.info(f"Snowflake Schema: {os.getenv('SNOWFLAKE_SCHEMA', 'Not specified')}")
    
    # Run the Flask app
    app.run(
        debug=os.getenv('FLASK_DEBUG', 'True').lower() == 'true',
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000))
    )
