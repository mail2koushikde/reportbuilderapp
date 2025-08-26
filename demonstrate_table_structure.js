// Simple demonstration of table structures
const sampleUserUpload = {
  tableName: "user_uploads_1703875200000_sales_report_csv",
  structure: {
    "Product": "TEXT",
    "Sales": "INTEGER", 
    "Region": "TEXT",
    "Quarter": "TEXT",
    "Year": "INTEGER"
  },
  sampleData: [
    {"Product": "Widget A", "Sales": 15000, "Region": "North", "Quarter": "Q1", "Year": 2024},
    {"Product": "Widget B", "Sales": 22000, "Region": "South", "Quarter": "Q1", "Year": 2024},
    {"Product": "Widget C", "Sales": 18500, "Region": "East", "Quarter": "Q1", "Year": 2024}
  ]
};

console.log("DATABASE TABLE STRUCTURES");
console.log("=" .repeat(50));
console.log("\n1. USER UPLOAD TABLE EXAMPLE:");
console.log("Table Name:", sampleUserUpload.tableName);
console.log("Schema:", JSON.stringify(sampleUserUpload.structure, null, 2));
console.log("Sample Data:", JSON.stringify(sampleUserUpload.sampleData, null, 2));
