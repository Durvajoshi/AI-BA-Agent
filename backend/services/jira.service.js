const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");

function createAuthHeader(jiraEmail, jiraApiToken) {
  const auth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString("base64");
  return {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json"
  };
}


// Helper function to generate project key
function generateProjectKey(title) {
  return title
    .replace(/[^A-Za-z]/g, "")
    .substring(0, 6)
    .toUpperCase();
}

function parseList(list) {
  if (!Array.isArray(list) || list.length === 0) return "N/A";

  return list
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null) {
        return (
          item.text ||
          item.description ||
          item.title ||
          JSON.stringify(item)
        );
      }
      return String(item);
    })
    .join("\n- ");
}

function buildJiraProjectSummary(ba, activityDiagram) {
  return `h2. ${ba.title || "BA Requirements"}

h3. User Stories
${parseList(ba.user_stories)}

h3. Assumptions
${parseList(ba.assumptions)}

h3. Constraints
${parseList(ba.constraints)}

h3. Out of Scope
${parseList(ba.out_of_scope)}

h3. Activity Diagram (Mermaid)
${activityDiagram || "N/A"}
`.trim();
}

// Helper function to sanitize project name
function sanitizeProjectName(title) {
  return title
    .replace(/requirement\s*documents?/gi, "")
    .replace(/requirements?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Create Jira Project
async function createJiraProject(title, projectSummary, jiraBase, headers, leadAccountId) {
  const cleanTitle = sanitizeProjectName(title);
  const key = generateProjectKey(cleanTitle);

  const payload = {
    key,
    name: cleanTitle,
    description: projectSummary,
    projectTypeKey: "software",
    projectTemplateKey: "com.pyxis.greenhopper.jira:gh-simplified-agility-kanban",
    leadAccountId: leadAccountId,
    assigneeType: "PROJECT_LEAD"
  };

  try {
    await axios.post(`${jiraBase}/rest/api/3/project`, payload, { headers });
  } catch (err) {
    console.error("Error creating Jira project:", err.response ? err.response.data : err.message);
    throw err;
  }

  return key;
}

// Create Epic (Functional Requirements / Non-Functional Requirements)
async function createEpic(projectKey, name, jiraBase, headers) {
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const payload = {
    fields: {
      project: { key: projectKey },
      summary: name,
      issuetype: { name: "Epic" },
      description: {
        version: 1,
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: `Epic for ${name}` }]
          }
        ]
      },
      duedate: dueDate
    }
  };

  try {
    const res = await axios.post(`${jiraBase}/rest/api/3/issue`, payload, { headers });
    console.log("Epic created:", res.data.key);
    return res.data.key;
  } catch (err) {
    console.error("Error creating Epic:", JSON.stringify(err.response?.data, null, 2));
    throw err;
  }
}

// Create Task linked to Epic (Using Parent Field)
async function createTaskUnderEpic(projectKey, epicKey, summary, description, jiraBase, headers) {
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const payload = {
    fields: {
      project: { key: projectKey },
      summary: summary,
      issuetype: { name: "Task" },
      parent: { key: epicKey },
      description: {
        version: 1,
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: description || "No description provided." }]
          }
        ]
      },
      duedate: dueDate
    }
  };

  try {
    const res = await axios.post(`${jiraBase}/rest/api/3/issue`, payload, { headers });
    console.log(`Task ${res.data.key} linked to Epic ${epicKey}`);
    return res.data.key;
  } catch (err) {
    console.error("Error creating Task:", JSON.stringify(err.response?.data, null, 2));
    throw err;
  }
}

function buildDescription(item) {
  let desc = item.description || "";

  if (Array.isArray(item.acceptance_criteria)) {
    desc += "\n\nAcceptance Criteria:\n";
    desc += item.acceptance_criteria.map(ac => `- ${ac}`).join("\n");
  }

  return desc || "No description provided.";
}


// Format BA (Business Analysis) document for Jira (convert lists to string)
function formatBAForJira(ba) {
  const parseList = (list) => {
    if (!Array.isArray(list) || list.length === 0) return "N/A";

    return list
      .map(item => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item !== null) {
          return (
            item.text ||
            item.description ||
            item.title ||
            JSON.stringify(item)
          );
        }
        return String(item);
      })
      .join("\n- ");
  };

  return `h2. ${ba.title || "BA Requirements"}

h3. Functional Requirements
${parseList(ba.functional_requirements)}

h3. Non-Functional Requirements
${parseList(ba.non_functional_requirements)}

h3. User Stories
${parseList(ba.user_stories)}
  `.trim();
}

// Convert Mermaid diagram to PNG using npx
async function convertMermaidToPng(diagramText) {
  const execAsync = promisify(exec);
  const tempDir = path.join(__dirname, "../temp");
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const timestamp = Date.now();
  const diagramFile = path.join(tempDir, `diagram-${timestamp}.mmd`);
  const outputFile = path.join(tempDir, `diagram-${timestamp}.png`);

  try {
    // Clean diagram: remove markdown code fence markers and excessive whitespace
    let cleanDiagram = diagramText
      .replace(/```mermaid\n?/g, "")
      .replace(/```\n?/g, "")
      .split('\n')
      .map(line => line.trim())  // Remove leading/trailing spaces from each line
      .filter(line => line.length > 0)  // Remove empty lines
      .join('\n')
      .trim();

    // Write cleaned diagram to file
    fs.writeFileSync(diagramFile, cleanDiagram);

    // Use npx to run mermaid-cli
    await execAsync(`npx @mermaid-js/mermaid-cli -i "${diagramFile}" -o "${outputFile}"`);

    // Read the PNG file
    const pngBuffer = fs.readFileSync(outputFile);

    // Clean up temp files
    fs.unlinkSync(diagramFile);
    fs.unlinkSync(outputFile);

    return pngBuffer;
  } catch (err) {
    console.error("Error converting diagram to PNG:", err.message);
    // Clean up on error
    if (fs.existsSync(diagramFile)) fs.unlinkSync(diagramFile);
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
    throw err;
  }
}

// Upload attachment to Jira issue
async function uploadAttachmentToJira(issueKey, fileName, fileBuffer, jiraBase, headers) {
  const url = `${jiraBase}/rest/api/3/issue/${issueKey}/attachments`;

  try {
    // Create form data for multipart upload
    const FormData = require("form-data");
    const form = new FormData();
    form.append("file", fileBuffer, fileName);

    await axios.post(url, form, {
      headers: {
        ...headers,
        "X-Atlassian-Token": "no-check",
        ...form.getHeaders()
      }
    });
    console.log(`Attachment ${fileName} uploaded to ${issueKey}`);
  } catch (err) {
    console.error(`Error uploading attachment to ${issueKey}:`, err.response?.data || err.message);
    throw err;
  }
}

// Create Issue (Story, Task, or Bug) without parent Epic
async function createIssue(projectKey, issueType, summary, description, jiraBase, headers) {
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const payload = {
    fields: {
      project: { key: projectKey },
      summary: summary,
      issuetype: { name: issueType },
      description: {
        version: 1,
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: description || "No description provided." }]
          }
        ]
      },
      duedate: dueDate
    }
  };

  try {
    const res = await axios.post(`${jiraBase}/rest/api/3/issue`, payload, { headers });
    console.log(`${issueType} ${res.data.key} created: ${summary}`);
    return res.data.key;
  } catch (err) {
    console.error(`Error creating ${issueType}:`, JSON.stringify(err.response?.data, null, 2));
    throw err;
  }
}

// Main function to export BA to Jira (create issues for outputs excluding FR and NFR)
async function exportToJira(ba, activityDiagram = null, jiraCredentials = {}) {
  // Use provided credentials or fallback to environment variables
  const jiraBase = jiraCredentials.baseUrl || process.env.JIRA_BASE_URL;
  const jiraEmail = jiraCredentials.email || process.env.JIRA_EMAIL;
  const jiraApiToken = jiraCredentials.apiToken || process.env.JIRA_API_TOKEN;
  const jiraLeadAccountId = jiraCredentials.leadAccountId || process.env.JIRA_LEAD_ACCOUNT_ID;

  const headers = createAuthHeader(jiraEmail, jiraApiToken);

  const projectSummary = buildJiraProjectSummary(ba, activityDiagram);
  // Create or ensure project exists
  const projectKey = await createJiraProject(ba.title, projectSummary, jiraBase, headers, jiraLeadAccountId);

  // Create Functional Requirements Epic
  const frEpicKey = await createEpic(projectKey, "Functional Requirements", jiraBase, headers);

  // Create Functional Requirement tasks under the FR Epic
  for (const fr of ba.functional_requirements || []) {
    console.log("Creating Functional Requirement task", fr);
    const frTitle = typeof fr === "string" ? fr : (fr.name || fr.title || "FR");
    const frDesc = typeof fr === "string" ? fr : (fr.description || JSON.stringify(fr));
    await createTaskUnderEpic(projectKey, frEpicKey, frTitle, frDesc, jiraBase, headers);
  }

  // Create Non-Functional Requirements Epic
  const nfrEpicKey = await createEpic(projectKey, "Non-Functional Requirements", jiraBase, headers);

  // Create Non-Functional Requirement tasks under the NFR Epic
  for (const nfr of ba.non_functional_requirements || []) {
    console.log("Creating Non-Functional Requirement task", nfr);
    const nfrTitle = typeof nfr === "string" ? nfr : (nfr.name || nfr.title || "NFR");
    const nfrDesc = typeof nfr === "string" ? nfr : (nfr.description || JSON.stringify(nfr));
    await createTaskUnderEpic(projectKey, nfrEpicKey, nfrTitle, nfrDesc, jiraBase, headers);
  }

  // Export Activity Diagram with PNG attachment
  if (activityDiagram) {
    console.log("Creating Activity Diagram issue");
    const diagramDescription = `See attached PNG image below.\n\nDiagram Definition (Mermaid):\n{code}${activityDiagram}{code}`;
    
    const activityDiagramIssue = await createIssue(
      projectKey,
      "Task",
      "Activity Diagram",
      diagramDescription,
      jiraBase,
      headers
    );

    try {
      // Convert mermaid to PNG
      const pngBuffer = await convertMermaidToPng(activityDiagram);
      // Upload PNG to the issue
      await uploadAttachmentToJira(activityDiagramIssue, "activity-diagram.png", pngBuffer, jiraBase, headers);
    } catch (err) {
      console.error("Failed to upload diagram image:", err.message);
      console.log("Diagram conversion failed. Using text definition as fallback.");
    }
  }

  // Export User Stories, Assumptions, Constraints, and Out of Scope in a single task
  let combinedDetails = "";

  if (ba.user_stories && ba.user_stories.length > 0) {
    const userStoriesText = ba.user_stories
      .map(us => typeof us === "string" ? `• ${us}` : `• ${us.description || JSON.stringify(us)}`)
      .join("\n");
    combinedDetails += `User Stories:\n${userStoriesText}\n\n`;
  }

  if (ba.assumptions && ba.assumptions.length > 0) {
    const assumptionsText = ba.assumptions
      .map(a => typeof a === "string" ? `• ${a}` : `• ${a.description || JSON.stringify(a)}`)
      .join("\n");
    combinedDetails += `Assumptions:\n${assumptionsText}\n\n`;
  }

  if (ba.constraints && ba.constraints.length > 0) {
    const constraintsText = ba.constraints
      .map(c => typeof c === "string" ? `• ${c}` : `• ${c.description || JSON.stringify(c)}`)
      .join("\n");
    combinedDetails += `Constraints:\n${constraintsText}\n\n`;
  }

  if (ba.out_of_scope && ba.out_of_scope.length > 0) {
    const outOfScopeText = ba.out_of_scope
      .map(o => typeof o === "string" ? `• ${o}` : `• ${o.description || JSON.stringify(o)}`)
      .join("\n");
    combinedDetails += `Out of Scope:\n${outOfScopeText}`;
  }

  if (combinedDetails.trim()) {
    console.log("Creating Requirements and Details task");
    await createIssue(
      projectKey,
      "Task",
      "Requirements & Details",
      combinedDetails.trim(),
      jiraBase,
      headers
    );
  }

  return projectKey;
}

// Export the function
module.exports = { exportToJira };
