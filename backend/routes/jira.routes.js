const express = require("express");
const router = express.Router();
const pool = require("../db/postgres");
const { exportToJira } = require("../services/jira.service");
const { getUserById } = require("../services/auth.service");

// STATUS CHECK: Frontend polls this
const authMiddleware = require("../middleware/auth.Middleware");

router.get("/status/:conversationId", authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;
    
    // Verify user owns this conversation
    const convoCheck = await pool.query(
      "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
      [conversationId, userId]
    );

    if (convoCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // Check both the document existence and the conversation's jira key
    const result = await pool.query(
      `SELECT d.exported_to_jira, c.jira_epic_key 
       FROM ba_documents d
       JOIN conversations c ON d.conversation_id = c.id
       WHERE d.conversation_id = $1 AND c.user_id = $2
       ORDER BY d.created_at DESC LIMIT 1`,
      [conversationId, userId]
    );

    if (result.rows.length > 0) {
      return res.json({ 
        exists: true, 
        isExported: !!result.rows[0].jira_epic_key,
        jiraKey: result.rows[0].jira_epic_key 
      });
    }
    
    res.json({ exists: false, isExported: false });
  } catch (err) {
    console.error("Status Check Error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// EXPORT/SYNC ROUTE
router.post("/export/:conversationId", authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    // Verify user owns this conversation
    const convoCheck = await pool.query(
      "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
      [conversationId, userId]
    );

    if (convoCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get user's Jira credentials
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prepare Jira credentials object
    const jiraCredentials = {
      baseUrl: user.jira_base_url,
      email: user.jira_email,
      apiToken: user.jira_api_token,
      leadAccountId: user.jira_lead_account_id
    };

    // UPDATE: We now order by v.version_number DESC to get the latest update
    const result = await pool.query(
      `SELECT v.ba_output,
              a.diagram_definition
       FROM conversations c
       JOIN ba_documents d ON c.id = d.conversation_id
       JOIN ba_versions v ON d.id = v.ba_document_id
       LEFT JOIN activity_diagrams a ON a.ba_version_id = v.id
       WHERE c.id = $1 AND c.user_id = $2
       ORDER BY v.version_number DESC LIMIT 1`,
      [conversationId, userId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: "No BA found" });

    const { ba_output, diagram_definition } = result.rows[0];

    // This will now send the NEWEST ba_output to Jira using user's credentials
    const projectKey = await exportToJira(ba_output, diagram_definition, jiraCredentials);

    // Save the key if it's new
    await pool.query(
      "UPDATE conversations SET jira_epic_key = $1, jira_exported = true WHERE id = $2",
      [projectKey, conversationId]
    );

    res.json({ projectKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;
