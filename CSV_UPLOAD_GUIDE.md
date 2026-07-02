# CSV Bulk Customer Upload Guide

## Overview
Shop admins can now bulk upload customers using a CSV file in the "Add New Customer" modal.

## CSV Format Requirements

Your CSV file must have the following columns in the header row:
- `name` (required) - Customer's full name
- `email` (optional) - Customer's email address
- `phone` (optional) - Customer's phone number
- `address` (optional) - Customer's physical address

## Example CSV File

```csv
name,email,phone,address
John Doe,john@example.com,555-0101,123 Main Street
Jane Smith,jane@example.com,555-0102,456 Oak Avenue
Bob Johnson,bob@example.com,555-0103,789 Pine Road
Alice Williams,alice@example.com,555-0104,321 Elm Court
Charlie Brown,charlie@example.com,555-0105,654 Maple Drive
```

## How to Use

1. Click the "Add New Customer" button in the Customer Directory
2. Toggle to "CSV Upload" mode
3. Select your CSV file using the file picker
4. Click "Upload CSV" to import the customers
5. The system will validate and import all valid customers
6. Any errors will be displayed with row numbers for reference

## Important Notes

- Only shop admins can upload CSV files (not shop staff)
- Maximum file size: 5MB
- Only CSV files are accepted
- The `name` column is required for each row
- Empty rows without names will be skipped
- All imported customers will be associated with the current shop (tenant)

## Error Handling

If there are validation errors in your CSV:
- The system will show which rows have errors
- Valid customers will still be imported
- Invalid rows will be skipped with specific error messages

## Sample File

A sample CSV file is included at: `test_customers.csv`
