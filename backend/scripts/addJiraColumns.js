const pool = require("../db/postgres");

async function addJiraColumns() {
  try {
    console.log("Adding Jira credential columns to users table...");
    
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS jira_base_url VARCHAR,
      ADD COLUMN IF NOT EXISTS jira_email VARCHAR,
      ADD COLUMN IF NOT EXISTS jira_api_token VARCHAR,
      ADD COLUMN IF NOT EXISTS jira_lead_account_id VARCHAR
    `);
    
    console.log("Columns added successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error adding columns:", err);
    process.exit(1);
  }
}

addJiraColumns();
