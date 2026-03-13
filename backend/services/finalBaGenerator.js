const pool = require("../db/postgres");
const { callGroq } = require("./ai.service");
const { v4: uuidv4 } = require("uuid");

async function generateFinalBA(conversationContext, conversationId = null) {
  // 🔒 KEEP ORIGINAL PROMPT (UNCHANGED)
  const systemPrompt = `
You are a senior Business Analyst.
Generate a COMPLETE and FINAL requirements document.

Rules:
- Output STRICT JSON only
- Follow this exact structure:
{
  "title": "",
  "functional_requirements": [],
  "non_functional_requirements": [],
  "user_stories": [],
  "assumptions": [],
  "constraints": [],
  "out_of_scope": []
}
- No explanations
- No markdown
- No extra text
`;

  // 🔹 Generate BA
  const baJsonString = await callGroq(systemPrompt, conversationContext);
  const baObject = JSON.parse(baJsonString); // fail fast

  // 🔥 MINIMAL SAFETY GUARD
  // If conversationId is NOT provided → DO NOT touch DB
  // (used during CHANGE / DIFF flow)
  if (!conversationId) {
    return baJsonString;
  }

  // 🔹 Create BA document (ONLY first final output)
  const docId = uuidv4();

  await pool.query(
    `INSERT INTO ba_documents (id, conversation_id, title, exported_to_jira)
     VALUES ($1,$2,$3,false)`,
    [docId, conversationId, baObject.title]
  );

  // 🔹 Version 1
  await pool.query(
    `INSERT INTO ba_versions (id, ba_document_id, version_number, ba_output)
     VALUES ($1,$2,1,$3)`,
    [uuidv4(), docId, baObject]
  );

  // 🔹 DO NOT auto-export anymore (button controlled)
  // exported_to_jira stays false until user clicks button

  return baJsonString;
}

module.exports = { generateFinalBA };
