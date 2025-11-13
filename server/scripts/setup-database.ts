#!/usr/bin/env ts-node

import { databaseService } from '../database/database-service';

// Sample data for initial setup
const sampleTables = {
  sales_data: [
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
  ],
  
  customer_data: [
    {"Customer_ID": 1001, "Customer_Name": "Acme Corp", "Industry": "Manufacturing", "Revenue": 250000, "City": "New York"},
    {"Customer_ID": 1002, "Customer_Name": "Tech Solutions", "Industry": "Technology", "Revenue": 180000, "City": "San Francisco"},
    {"Customer_ID": 1003, "Customer_Name": "Global Retail", "Industry": "Retail", "Revenue": 320000, "City": "Chicago"},
    {"Customer_ID": 1004, "Customer_Name": "Finance Plus", "Industry": "Financial", "Revenue": 450000, "City": "Boston"},
    {"Customer_ID": 1005, "Customer_Name": "Health Systems", "Industry": "Healthcare", "Revenue": 380000, "City": "Los Angeles"},
    {"Customer_ID": 1006, "Customer_Name": "Energy Co", "Industry": "Energy", "Revenue": 520000, "City": "Houston"},
    {"Customer_ID": 1007, "Customer_Name": "Food Chain", "Industry": "Food & Beverage", "Revenue": 290000, "City": "Miami"},
    {"Customer_ID": 1008, "Customer_Name": "Auto Parts", "Industry": "Automotive", "Revenue": 210000, "City": "Detroit"}
  ],
  
  financial_data: [
    {"Category": "Forecast", "Amount": 133203153, "Type": "Projected", "Department": "Sales"},
    {"Category": "Actuals", "Amount": 94522006, "Type": "Actual", "Department": "Sales"},
    {"Category": "Plan", "Amount": 21050016, "Type": "Budget", "Department": "Marketing"},
    {"Category": "Forecast", "Amount": 45678900, "Type": "Projected", "Department": "Operations"},
    {"Category": "Actuals", "Amount": 67890123, "Type": "Actual", "Department": "Operations"},
    {"Category": "Plan", "Amount": 34567890, "Type": "Budget", "Department": "R&D"},
    {"Category": "Forecast", "Amount": 23456789, "Type": "Projected", "Department": "HR"},
    {"Category": "Actuals", "Amount": 56789012, "Type": "Actual", "Department": "Finance"}
  ]
};

async function setupDatabase() {
  try {
    console.log('Initializing database...');
    await databaseService.initialize();
    
    const dbType = databaseService.getDatabaseType();
    console.log(`Database type: ${dbType}`);
    console.log(`Database config:`, databaseService.getConfig());
    
    // Test connection
    const isHealthy = await databaseService.testConnection();
    console.log(`Database connection: ${isHealthy ? 'healthy' : 'failed'}`);
    
    if (!isHealthy) {
      throw new Error('Database connection test failed');
    }
    
    // Create sample tables
    for (const [tableName, data] of Object.entries(sampleTables)) {
      console.log(`Creating table: ${tableName}`);
      await databaseService.createTableFromData(tableName, data, true);
      console.log(`✓ Created table '${tableName}' with ${data.length} rows`);
    }
    
    // List all tables
    const tables = await databaseService.getTables();
    console.log('\nAvailable tables:');
    for (const table of tables) {
      const schema = await databaseService.getTableSchema(table);
      const tableData = await databaseService.getTableData(table, 5); // Get first 5 rows
      console.log(`  - ${table} (${schema.length} columns, ${tableData.rowCount} rows)`);
      console.log(`    Columns: ${schema.join(', ')}`);
    }
    
    console.log('\n✅ Database setup completed successfully!');
    
    // Test queries
    console.log('\nTesting sample queries:');
    
    const salesResult = await databaseService.query(
      'SELECT Product, SUM(Sales) as Total_Sales FROM sales_data GROUP BY Product ORDER BY Total_Sales DESC'
    );
    console.log(`Sales by product:`, salesResult.data);
    
    console.log('\n🎉 Database is ready for use!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await databaseService.close();
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  setupDatabase();
}

export { setupDatabase };
