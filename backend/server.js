require('dotenv').config();
const pool = require("./db/postgres");
const runMigrations = require("./db/migrate");
const express = require("express");
const cors = require("cors");
const chatRoutes = require("./routes/chat.routes");
const jiraRoutes = require('./routes/jira.routes');
const authRoutes = require('./routes/auth.routes');
const authMiddleware = require('./middleware/auth.middleware');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/jira', authMiddleware, jiraRoutes);
app.use("/api/chat", authMiddleware, chatRoutes);

app.get("/db-test", async (req, res) => {
  const result = await pool.query("SELECT NOW()");
  res.json(result.rows[0]);
});


app.get("/health", (req, res) => {
  res.json({ status: "Backend running" });
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

// 404 handler for debugging
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ error: "Not Found" });
});

// Run migrations before starting the server
runMigrations()
  .then(() => {
    const PORT = 5000;
    app.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("Failed to run migrations:", err);
    process.exit(1);
  });
