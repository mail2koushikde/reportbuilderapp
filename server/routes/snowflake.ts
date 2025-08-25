import { Request, Response, Router } from "express";

const router = Router();

// Health check endpoint
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "healthy", service: "snowflake-api" });
});

// Test connection endpoint
router.post("/test-connection", (_req: Request, res: Response) => {
  res.json({ success: true, message: "Test mode - connection simulation successful" });
});

// Sample data generator
function getSampleData(queryType: string, queryInput: string) {
  const queryLower = queryInput.toLowerCase();
  
  if (queryType === 'table') {
    if (queryLower.includes('sales')) {
      return {
        data: [
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
        columns: ["Product", "Sales", "Region", "Quarter", "Year"]
      };
    } else if (queryLower.includes('customer')) {
      return {
        data: [
          {"Customer_ID": 1001, "Customer_Name": "Acme Corp", "Industry": "Manufacturing", "Revenue": 250000, "City": "New York"},
          {"Customer_ID": 1002, "Customer_Name": "Tech Solutions", "Industry": "Technology", "Revenue": 180000, "City": "San Francisco"},
          {"Customer_ID": 1003, "Customer_Name": "Global Retail", "Industry": "Retail", "Revenue": 320000, "City": "Chicago"},
          {"Customer_ID": 1004, "Customer_Name": "Finance Plus", "Industry": "Financial", "Revenue": 450000, "City": "Boston"},
          {"Customer_ID": 1005, "Customer_Name": "Health Systems", "Industry": "Healthcare", "Revenue": 380000, "City": "Los Angeles"},
          {"Customer_ID": 1006, "Customer_Name": "Energy Co", "Industry": "Energy", "Revenue": 520000, "City": "Houston"},
          {"Customer_ID": 1007, "Customer_Name": "Food Chain", "Industry": "Food & Beverage", "Revenue": 290000, "City": "Miami"},
          {"Customer_ID": 1008, "Customer_Name": "Auto Parts", "Industry": "Automotive", "Revenue": 210000, "City": "Detroit"}
        ],
        columns: ["Customer_ID", "Customer_Name", "Industry", "Revenue", "City"]
      };
    } else {
      // Generic financial data (matches existing chart structure)
      return {
        data: [
          {"Category": "Forecast", "Amount": 133203153, "Type": "Projected", "Department": "Sales"},
          {"Category": "Actuals", "Amount": 94522006, "Type": "Actual", "Department": "Sales"},
          {"Category": "Plan", "Amount": 21050016, "Type": "Budget", "Department": "Marketing"},
          {"Category": "Forecast", "Amount": 45678900, "Type": "Projected", "Department": "Operations"},
          {"Category": "Actuals", "Amount": 67890123, "Type": "Actual", "Department": "Operations"},
          {"Category": "Plan", "Amount": 34567890, "Type": "Budget", "Department": "R&D"},
          {"Category": "Forecast", "Amount": 23456789, "Type": "Projected", "Department": "HR"},
          {"Category": "Actuals", "Amount": 56789012, "Type": "Actual", "Department": "Finance"}
        ],
        columns: ["Category", "Amount", "Type", "Department"]
      };
    }
  } else {
    // For SQL queries, return aggregated sample data
    return {
      data: [
        {"Product_Category": "Electronics", "Total_Sales": 567890, "Avg_Price": 299.99, "Order_Count": 1234},
        {"Product_Category": "Clothing", "Total_Sales": 432100, "Avg_Price": 89.50, "Order_Count": 2341},
        {"Product_Category": "Home & Garden", "Total_Sales": 345678, "Avg_Price": 156.75, "Order_Count": 987},
        {"Product_Category": "Sports", "Total_Sales": 234567, "Avg_Price": 124.99, "Order_Count": 1567},
        {"Product_Category": "Books", "Total_Sales": 123456, "Avg_Price": 24.99, "Order_Count": 3456}
      ],
      columns: ["Product_Category", "Total_Sales", "Avg_Price", "Order_Count"]
    };
  }
}

// Test import endpoint (returns sample data)
router.post("/test-import", (req: Request, res: Response) => {
  try {
    const { queryType, query, limit } = req.body;
    
    if (!query || !query.trim()) {
      return res.status(400).json({ error: "Query or table name is required" });
    }
    
    const sampleResult = getSampleData(queryType || 'table', query.trim());
    
    console.log(`Test import returning ${sampleResult.data.length} rows for query: ${query}`);
    
    res.json({
      success: true,
      data: sampleResult.data,
      columns: sampleResult.columns,
      rowCount: sampleResult.data.length,
      query: `TEST MODE: ${query}`,
      isTestData: true
    });
    
  } catch (error) {
    console.error('Test import failed:', error);
    res.status(500).json({ error: `Test import failed: ${error}` });
  }
});

// Production import endpoint (placeholder)
router.post("/import", (req: Request, res: Response) => {
  res.status(501).json({
    success: false,
    error: "Production Snowflake import requires proper setup. Use test mode instead."
  });
});

// List tables endpoint (returns sample table list)
router.get("/tables", (_req: Request, res: Response) => {
  const sampleTables = [
    { TABLE_NAME: "SALES_DATA", TABLE_SCHEMA: "PUBLIC", TABLE_TYPE: "TABLE" },
    { TABLE_NAME: "CUSTOMER_DATA", TABLE_SCHEMA: "PUBLIC", TABLE_TYPE: "TABLE" },
    { TABLE_NAME: "FINANCIAL_DATA", TABLE_SCHEMA: "PUBLIC", TABLE_TYPE: "TABLE" },
    { TABLE_NAME: "PRODUCTS", TABLE_SCHEMA: "PUBLIC", TABLE_TYPE: "TABLE" },
    { TABLE_NAME: "ORDERS", TABLE_SCHEMA: "PUBLIC", TABLE_TYPE: "TABLE" }
  ];
  
  res.json({
    success: true,
    tables: sampleTables
  });
});

export default router;
