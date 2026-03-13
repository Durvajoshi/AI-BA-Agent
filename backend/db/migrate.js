const pool = require("./postgres");

async function runMigrations() {
  try {
    console.log("Starting database migrations...");

    // Add title column to conversations if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS title VARCHAR(255);
      `);
      console.log("✓ title column added to conversations (if needed)");
    } catch (err) {
      console.error("Warning: Could not add title column:", err.message);
    }

    // Add preview column to conversations if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS preview TEXT;
      `);
      console.log("✓ preview column added to conversations (if needed)");
    } catch (err) {
      console.error("Warning: Could not add preview column:", err.message);
    }

    // Add clarification_done column to conversations if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS clarification_done BOOLEAN DEFAULT false;
      `);
      console.log("✓ clarification_done column added to conversations (if needed)");
    } catch (err) {
      console.error("Warning: Could not add clarification_done column:", err.message);
    }

    // Add updated_at column to conversations if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      `);
      console.log("✓ updated_at column added to conversations (if needed)");
    } catch (err) {
      console.error("Warning: Could not add updated_at column:", err.message);
    }

    // Add email verification columns to users table
    try {
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
      `);
      console.log("✓ email_verified column added to users (if needed)");
    } catch (err) {
      console.error("Warning: Could not add email_verified column:", err.message);
    }

    // Add email_verified_at column to users table
    try {
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;
      `);
      console.log("✓ email_verified_at column added to users (if needed)");
    } catch (err) {
      console.error("Warning: Could not add email_verified_at column:", err.message);
    }

    // Create OTP codes table if it doesn't exist
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS otp_codes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) NOT NULL,
          code VARCHAR(6) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          is_verified BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("✓ otp_codes table created (if needed)");
    } catch (err) {
      console.error("Warning: Could not create otp_codes table:", err.message);
    }

    // Create index on otp_codes email column
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);
      `);
      console.log("✓ index on otp_codes.email created (if needed)");
    } catch (err) {
      console.error("Warning: Could not create index on otp_codes.email:", err.message);
    }

    console.log("Database migrations completed successfully");
    return true;
  } catch (err) {
    console.error("Migration error:", err.message);
    throw err;
  }
}

module.exports = runMigrations;
