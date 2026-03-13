const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "ai_ba_agent",
  password: "seaneb2212",
  port: 5432,
});

module.exports = pool;
