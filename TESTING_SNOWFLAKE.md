# Testing Snowflake Import Functionality

## Quick Test (No Snowflake Account Required)

### 1. Start the Flask API

```bash
cd api
pip install -r requirements.txt
python start.py
```

The API will start even without Snowflake credentials when using test mode.

### 2. Test the Import Feature

1. **Open your application** in the browser
2. **Click the blue database icon** next to the "Upload Data" button
3. **Ensure "Test Mode" is enabled** (yellow toggle should be ON)
4. **Try these sample queries:**

#### Test Table Names:
- `sales_data` - Returns sales data with Product, Sales, Region, Quarter, Year
- `customer_data` - Returns customer data with ID, Name, Industry, Revenue, City  
- `financial_data` - Returns financial data with Category, Amount, Type, Department

#### Test SQL Queries:
- `SELECT * FROM products WHERE category = 'Electronics'`
- `SELECT product, SUM(sales) FROM sales_data GROUP BY product`
- Any SQL query (returns sample aggregated data)

### 3. What You Should See

✅ **Success Case:** Data imports into your dashboard and becomes available for creating charts  
✅ **Data appears** in the uploaded filename indicator  
✅ **Charts can be created** using the imported columns  
✅ **Same experience** as CSV file upload  

## Real Snowflake Testing

### Option 1: Snowflake Free Trial

1. **Sign up** for a [Snowflake free trial](https://trial.snowflake.com/)
2. **Get your account details** (Account ID, Username, Password)
3. **Create `.env` file** in the `api/` folder:

```env
SNOWFLAKE_USER=your_username
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_ACCOUNT=your_account_identifier
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_DATABASE=SNOWFLAKE_SAMPLE_DATA
SNOWFLAKE_SCHEMA=TPCH_SF1
```

4. **Turn off Test Mode** in the UI
5. **Try these real tables:**
   - `CUSTOMER` - Customer information
   - `ORDERS` - Order data
   - `LINEITEM` - Line item details

### Option 2: Use Sample Data

Snowflake trials come with sample databases. Try:
- `SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.CUSTOMER`
- `SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS`
- `SNOWFLAKE_SAMPLE_DATA.WEATHER.DAILY_14_TOTAL`

## Test Scenarios

### ✅ Happy Path Tests
1. **Table import** with valid table name
2. **SQL query** with SELECT statement
3. **Data visualization** - Create charts with imported data
4. **Multiple imports** - Import different datasets

### ⚠️ Error Handling Tests
1. **Empty query** - Should show validation error
2. **Invalid table name** - Should show appropriate error
3. **API server down** - Should show connection error
4. **Invalid credentials** (production mode) - Should show auth error

### 🔄 UI Flow Tests
1. **Toggle between modes** - Test vs Production
2. **Switch query types** - Table vs SQL
3. **Cancel modal** - Should reset form
4. **Success flow** - Import → Create Chart → Visualize

## Sample Data Structure

When using test mode, you'll get data like:

```json
// sales_data
{
  "Product": "Widget A",
  "Sales": 15000,
  "Region": "North", 
  "Quarter": "Q1",
  "Year": 2024
}

// customer_data  
{
  "Customer_ID": 1001,
  "Customer_Name": "Acme Corp",
  "Industry": "Manufacturing",
  "Revenue": 250000,
  "City": "New York"
}
```

Perfect for testing different chart types (bar, pie, line) and configurations!
