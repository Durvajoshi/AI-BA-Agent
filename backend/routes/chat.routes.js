const express = require("express");
const { v4: uuidv4 } = require("uuid");
const pool = require("../db/postgres");

const {
  handleClarification,
  handleChange,
  generateDiagram,
  generateGherkin,
  generateSchema,
  generatePrototype
} = require("../services/ba.service");

const { generateFinalBA } = require("../services/finalBaGenerator");
const { diffBA } = require("../services/diff.service");
const { generateChangeSummary } = require("../services/changeSummary.service");
const serialize = require("../utils/serialize");

const router = express.Router();

/* ===============================
   CREATE CONVERSATION
================================ */
router.post("/conversation", async (req, res) => {
  // Just return a UUID - don't save to DB until first message is sent
  // This prevents empty conversations from being created
  const conversationId = uuidv4();
  res.json({ conversationId });
});

/* ===============================
   GET ALL CONVERSATIONS FOR USER
================================ */
router.get("/conversations", async (req, res) => {
  const userId = req.user.userId;

  const result = await pool.query(
    `SELECT id, title, preview, is_pinned, pin_order, created_at, updated_at
     FROM conversations
     WHERE user_id = $1
     ORDER BY is_pinned DESC, pin_order DESC, updated_at DESC`,
    [userId]
  );

  res.json(result.rows);
});

/* ===============================
   UPDATE CONVERSATION TITLE
================================ */
router.put("/conversation/:id/title", async (req, res) => {
  const { title } = req.body;
  const userId = req.user.userId;

  // Verify user owns this conversation
  const convoCheck = await pool.query(
    "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
    [req.params.id, userId]
  );

  if (convoCheck.rows.length === 0) {
    return res.status(403).json({ error: "Access denied" });
  }

  await pool.query(
    "UPDATE conversations SET title=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2",
    [title, req.params.id]
  );

  res.json({ success: true });
});

/* ===============================
   PIN/UNPIN CONVERSATION
================================ */
router.put("/conversation/:id/pin", async (req, res) => {
  const { isPinned } = req.body;
  const userId = req.user.userId;

  // Verify user owns this conversation
  const convoCheck = await pool.query(
    "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
    [req.params.id, userId]
  );

  if (convoCheck.rows.length === 0) {
    return res.status(403).json({ error: "Access denied" });
  }

  const timestamp = isPinned ? Date.now() : 0;
  await pool.query(
    "UPDATE conversations SET is_pinned=$1, pin_order=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3",
    [isPinned, timestamp, req.params.id]
  );

  res.json({ success: true });
});

/* ===============================
   DELETE CONVERSATION
================================ */
router.delete("/conversation/:id", async (req, res) => {
  const userId = req.user.userId;

  // Verify user owns this conversation
  const convoCheck = await pool.query(
    "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
    [req.params.id, userId]
  );

  if (convoCheck.rows.length === 0) {
    return res.status(403).json({ error: "Access denied" });
  }

  // Delete related records
  await pool.query(
    `DELETE FROM jira_issues 
     WHERE ba_version_id IN (
       SELECT v.id FROM ba_versions v
       JOIN ba_documents d ON v.ba_document_id = d.id
       WHERE d.conversation_id = $1
     )`,
    [req.params.id]
  );

  await pool.query(
    `DELETE FROM activity_diagrams 
     WHERE ba_version_id IN (
       SELECT v.id FROM ba_versions v
       JOIN ba_documents d ON v.ba_document_id = d.id
       WHERE d.conversation_id = $1
     )`,
    [req.params.id]
  );

  await pool.query(
    `DELETE FROM ba_versions 
     WHERE ba_document_id IN (
       SELECT id FROM ba_documents WHERE conversation_id = $1
     )`,
    [req.params.id]
  );

  await pool.query(
    "DELETE FROM ba_documents WHERE conversation_id = $1",
    [req.params.id]
  );

  await pool.query(
    "DELETE FROM messages WHERE conversation_id = $1",
    [req.params.id]
  );

  await pool.query(
    "DELETE FROM conversations WHERE id = $1",
    [req.params.id]
  );

  res.json({ success: true });
});

/* ===============================
   LOAD MESSAGES
================================ */
router.get("/conversation/:id/messages", async (req, res) => {
  const userId = req.user.userId;
  
  // Verify user owns this conversation
  const convoCheck = await pool.query(
    "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
    [req.params.id, userId]
  );

  if (convoCheck.rows.length === 0) {
    return res.status(403).json({ error: "Access denied" });
  }

  const result = await pool.query(
    `SELECT sender, content
     FROM messages
     WHERE conversation_id=$1
     ORDER BY created_at`,
    [req.params.id]
  );

  res.json(result.rows);
});

/* ===============================
   SEND MESSAGE
================================ */
router.post("/message", async (req, res) => {
  const { conversationId, content } = req.body;
  const userId = req.user.userId;

  // Check if conversation exists
  let convoOwner = await pool.query(
    "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
    [conversationId, userId]
  );

  // Check if this is the first message to auto-generate title
  const messageCount = await pool.query(
    "SELECT COUNT(*) FROM messages WHERE conversation_id = $1",
    [conversationId]
  );

  const isFirstMessage = messageCount.rows[0].count === 0;

  // If conversation doesn't exist, create it now (on first message)
  if (convoOwner.rows.length === 0) {
    // Generate title and preview from first message
    const title = content.substring(0, 50).trim() || "New Chat";
    const preview = content.substring(0, 100).trim();
    
    try {
      await pool.query(
        "INSERT INTO conversations (id, user_id, title, preview, clarification_done, created_at, updated_at) VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        [conversationId, userId, title, preview]
      );
      console.log(`Created new conversation ${conversationId} with title: ${title}`);
    } catch (err) {
      // If insert fails (e.g., duplicate), verify it belongs to user
      convoOwner = await pool.query(
        "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
        [conversationId, userId]
      );
      
      if (convoOwner.rows.length === 0) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
  }
  
  // Save user message
  await pool.query(
    `INSERT INTO messages (id, conversation_id, sender, content)
     VALUES ($1,$2,'user',$3)`,
    [uuidv4(), conversationId, String(content)]
  );

  // Only update preview on subsequent messages, never change the title
  // Title is set only once when conversation is created with first message
  if (!isFirstMessage) {
    const preview = content.substring(0, 100).trim();
    await pool.query(
      "UPDATE conversations SET preview=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2",
      [preview, conversationId]
    );
  }

  // Conversation state
  const convo = await pool.query(
    "SELECT clarification_done FROM conversations WHERE id=$1",
    [conversationId]
  );

  const clarificationDone = convo.rows[0]?.clarification_done ?? false;

  // Latest BA version
  const versionCheck = await pool.query(
    `SELECT v.id,
            v.version_number,
            v.ba_output,
            d.id AS doc_id
     FROM ba_versions v
     JOIN ba_documents d ON v.ba_document_id = d.id
     JOIN conversations c ON d.conversation_id = c.id
     WHERE d.conversation_id=$1 AND c.user_id=$2
     ORDER BY v.version_number DESC
     LIMIT 1`,
    [conversationId, userId]
  );

  const hasBaseline = versionCheck.rowCount > 0;

  /* ===============================
     CHANGE MODE
================================ */
  if (hasBaseline) {
    const previous = versionCheck.rows[0];

    const impactText = await handleChange(
      JSON.stringify(previous.ba_output),
      content
    );

    const rawNewBA = await generateFinalBA(
      `Original BA: ${JSON.stringify(previous.ba_output)}\nChange Request: ${content}`
    );

    const newBA = typeof rawNewBA === "string" ? JSON.parse(rawNewBA) : rawNewBA;

    const diff = diffBA(previous.ba_output, newBA);
    const summary = generateChangeSummary(diff);

    const newVersionId = uuidv4();

    await pool.query(
      `INSERT INTO ba_versions
       (id, ba_document_id, version_number, ba_output, change_summary, diff)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        newVersionId,
        previous.doc_id,
        previous.version_number + 1,
        newBA,
        summary,
        diff
      ]
    );

    // 🔹 Activity Diagram
    // 🔹 Generate all specifications at once
// 🔹 Generate all specifications for the updated BA
    // 🔹 Generate specifications separately
const [diagram, gherkin, schema] = await Promise.all([
  generateDiagram(newBA),
  generateGherkin(newBA),
  generateSchema(newBA)
]);

await pool.query(
  `INSERT INTO activity_diagrams (id, ba_version_id, diagram_definition, gherkin_definition, schema_definition)
   VALUES ($1, $2, $3, $4, $5)`,
  [uuidv4(), newVersionId, diagram, gherkin, schema]
);

    const aiText = `${impactText}\n\n✅ Updates Applied:\n${summary}`;

    await pool.query(
      `INSERT INTO messages (id, conversation_id, sender, content)
       VALUES ($1,$2,'ai',$3)`,
      [uuidv4(), conversationId, aiText]
    );

    return res.json({ reply: aiText });
  }

  /* ===============================
     FINAL BA GENERATION
================================ */
  if (clarificationDone) {
    const context = await pool.query(
      `SELECT sender, content
       FROM messages
       WHERE conversation_id=$1
       ORDER BY created_at`,
      [conversationId]
    );

    const conversationText = context.rows
      .map(m => `${m.sender}: ${serialize(m.content)}`)
      .join("\n");

    const finalBA = JSON.parse(
      await generateFinalBA(conversationText)
    );

    const baDocumentId = uuidv4();
    const baVersionId = uuidv4();

    await pool.query(
      `INSERT INTO ba_documents (id, conversation_id, title)
       VALUES ($1,$2,$3)`,
      [baDocumentId, conversationId, finalBA.title]
    );

    await pool.query(
      `INSERT INTO ba_versions
       (id, ba_document_id, version_number, ba_output)
       VALUES ($1,$2,1,$3)`,
      [baVersionId, baDocumentId, finalBA]
    );

    // 🔹 Activity Diagram
    // 🔹 Generate all specifications for the final BA
    // 🔹 Generate specifications separately
const [diagram, gherkin, schema] = await Promise.all([
  generateDiagram(finalBA),
  generateGherkin(finalBA),
  generateSchema(finalBA),
]);
const prototype = await generatePrototype(finalBA, diagram, schema);

await pool.query(
  `INSERT INTO activity_diagrams 
   (id, ba_version_id, diagram_definition, gherkin_definition, schema_definition, prototype_definition)
   VALUES ($1, $2, $3, $4, $5, $6)`,
  [uuidv4(), baVersionId, diagram, gherkin, schema, prototype]
);

    const aiText = JSON.stringify(finalBA, null, 2);

    await pool.query(
      `INSERT INTO messages (id, conversation_id, sender, content)
       VALUES ($1,$2,'ai',$3)`,
      [uuidv4(), conversationId, aiText]
    );

    return res.json({ reply: aiText });
  }

  /* ===============================
     CLARIFICATION
================================ */
const clarificationReply = await handleClarification("", content);
  await pool.query(
    "UPDATE conversations SET clarification_done=true WHERE id=$1",
    [conversationId]
  );

  await pool.query(
    `INSERT INTO messages (id, conversation_id, sender, content)
     VALUES ($1,$2,'ai',$3)`,
    [uuidv4(), conversationId, clarificationReply]
  );

  res.json({ reply: clarificationReply });
});

/* ===============================
   FETCH LATEST ACTIVITY DIAGRAM
================================ */
router.get("/conversation/:id/activity-diagram", async (req, res) => {
  const userId = req.user.userId;
  const result = await pool.query(
    `SELECT a.diagram_definition, a.gherkin_definition, a.schema_definition, a.prototype_definition
     FROM activity_diagrams a
     JOIN ba_versions v ON a.ba_version_id = v.id
     JOIN ba_documents d ON v.ba_document_id = d.id
     JOIN conversations c ON d.conversation_id = c.id
     WHERE d.conversation_id = $1 AND c.user_id = $2
     ORDER BY v.version_number DESC
     LIMIT 1`,
    [req.params.id, userId]
  );

  if (result.rows.length === 0) {
    return res.json({ diagram: null, gherkin: null, schema: null });
  }

  res.json({ 
  diagram: result.rows[0].diagram_definition,
  gherkin: result.rows[0].gherkin_definition,
  schema: result.rows[0].schema_definition,
  prototype: result.rows[0].prototype_definition
});
});


router.post("/conversation/:id/generate-prototype", async (req, res) => {
  // Fetch the latest BA, diagram, and schema for this conversation
  const userId = req.user.userId;
  const result = await pool.query(
    `SELECT v.ba_output, a.diagram_definition, a.schema_definition
     FROM ba_versions v
     JOIN ba_documents d ON v.ba_document_id = d.id
     JOIN conversations c ON d.conversation_id = c.id
     JOIN activity_diagrams a ON a.ba_version_id = v.id
     WHERE c.id = $1 AND c.user_id = $2
     ORDER BY v.version_number DESC
     LIMIT 1`,
    [req.params.id, userId]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: "No BA found" });
  }

  try {
    const { ba_output, diagram_definition, schema_definition } = result.rows[0];
    const prototypeObj = await generatePrototype(ba_output, diagram_definition, schema_definition);
    console.log('Generated prototype:', prototypeObj.prototype);
    const finalPrototype =
      prototypeObj && prototypeObj.prototype && prototypeObj.prototype.trim().startsWith("const PreviewApp = () =>")
        ? prototypeObj.prototype
        : `const PreviewApp = () => {\n  return (\n    <div className="p-4">\n      <h1>Minimal Preview</h1>\n      <p>No valid prototype could be generated.</p>\n    </div>\n  );\n};\n\n<PreviewApp />`;
// Save prototype to DB
await pool.query(
  `UPDATE activity_diagrams
   SET prototype_definition = $1
   WHERE ba_version_id = (
     SELECT v.id
     FROM ba_versions v
     JOIN ba_documents d ON v.ba_document_id = d.id
     JOIN conversations c ON d.conversation_id = c.id
     WHERE c.id = $2 AND c.user_id = $3
     ORDER BY v.version_number DESC
     LIMIT 1
   )`,
  [finalPrototype, req.params.id, userId]
);

res.json({ prototype: finalPrototype });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Prototype generation failed" });
  }
});
/* ===============================
   CLEANUP EMPTY CONVERSATIONS
================================ */
router.post("/cleanup-empty-conversations", async (req, res) => {
  const userId = req.user.userId;

  try {
    // Find conversations with no messages
    const emptyConvos = await pool.query(
      `SELECT c.id FROM conversations c
       LEFT JOIN messages m ON c.id = m.conversation_id
       WHERE c.user_id = $1
       GROUP BY c.id
       HAVING COUNT(m.id) = 0`,
      [userId]
    );

    // Delete empty conversations
    for (const convo of emptyConvos.rows) {
      await pool.query(
        "DELETE FROM conversations WHERE id = $1",
        [convo.id]
      );
    }

    res.json({ success: true, deletedCount: emptyConvos.rows.length });
  } catch (err) {
    console.error("Cleanup error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
