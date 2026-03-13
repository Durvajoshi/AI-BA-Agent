const { callGroq } = require("./ai.service");

async function handleClarification(context, userMessage) {
  const systemPrompt = `
ROLE:
You are a Senior Business Analyst performing requirement intake.

OBJECTIVE:
The user provided a vague or incomplete software requirement.
Your task is to ask exactly 4 clarification questions.

STRICT RULES:
Ask exactly 4 questions.
Ask questions only.
Do NOT suggest solutions.
Do NOT infer missing details.
Do NOT generate requirements.
Do NOT explain reasoning.
Do NOT use markdown.
Do NOT use headings.
Do NOT use bullet points.
Keep each question concise and unambiguous.
If the user message is empty or unclear, still ask 4 foundational clarification questions.
If complete, say: "READY_FOR_FINAL_OUTPUT".
`;

  return callGroq(systemPrompt, context + "\nUser: " + userMessage);
}

async function handleChange(context, userMessage) {
  const systemPrompt = `
You are a Senior Business Analyst updating a Requirements Document.
You will be provided with the PREVIOUS_BA_JSON and a CHANGE_REQUEST.

STRICT RULES:
1. Generate a COMPLETE, updated requirements document.
2. Maintain the EXACT same JSON structure as the input.
3. Integrate the CHANGE_REQUEST into all relevant sections (Functional, User Stories, etc.).
4. Consistency: If a feature is added, ensure corresponding Assumptions or Non-Functional requirements are updated.
5. Output STRICT JSON only.
6. No markdown code blocks, no preamble, no explanations.

STRUCTURE:
{
  "title": "",
  "functional_requirements": [],
  "non_functional_requirements": [],
  "user_stories": [],
  "assumptions": [],
  "constraints": [],
  "out_of_scope": []
}

PREVIOUS_BA_JSON:
${JSON.stringify(context)}

CHANGE_REQUEST:
${userMessage}
`;

  return callGroq(systemPrompt, context + "\nChange Request: " + userMessage);
}

async function generateDiagram(baJson) {
  const systemPrompt = `
Role: Senior Business Analyst & Systems Architect.
Task: Generate a workflow diagram for the provided BA JSON using Mermaid syntax.

STRICT OUTPUT RULES:

Format: Output ONLY raw Mermaid flowchart TD code.

Cleanliness: No markdown code blocks , no preamble, and no conversational filler.
In Mermaid styling/class directives, ensure node lists are comma-separated with NO spaces (e.g., use 'class A,B,C style' NOT 'class A, B, C style').
ID Logic: Use short, alphanumeric IDs for nodes (e.g., A1, B2).
Labeling: Place all descriptive text inside brackets linked to the ID.
Correct: A1[User Logs In] --> B1{Valid?}
Incorrect: User Logs In --> Valid?
Special Characters: Do not use parentheses (), brackets [], or quotes "" inside the node labels unless they are escaped. Stick to plain text for labels.
Decision Nodes: Use braces {} for decision points and brackets [] for process steps.
Symmetry Rule: Every node shape must use matching opening and closing characters: ID[Label] for rectangles, ID{Label} for diamonds, or ID([Label]) for rounded edges. Never mix them.
Syntax Integrity: Ensure every path is closed or leads to a terminal node. Use standard --> for connectors.


START OUTPUT WITH: flowchart TD
`;

  return callGroq(systemPrompt, JSON.stringify(baJson));
}


async function generateGherkin(baJson) {
  const systemPrompt = `
You are a QA Business Analyst.

Generate Acceptance Criteria in Gherkin format.

STRICT RULES:
1. Use Given/When/Then.
2. Each scenario must be testable.
3. No headers.
4. No explanations.
5. No markdown.
`;

  return callGroq(systemPrompt, JSON.stringify(baJson));
}

async function generateSchema(baJson) {
  const systemPrompt = `
You are a Senior Data Analyst.
Understand the requirements and data needs from the BA JSON.
Generate  Markdown Data Dictionary tables based on your understanding for the project.

STRICT RULES:
1. Columns: Field Name | Type | Description | Allowed Values
2. Proper Markdown table format.
3. No headers outside table.
4. No explanations.
5. No code fences.
`;

  return callGroq(systemPrompt, JSON.stringify(baJson));
}
async function generatePrototype(baJson, diagram, schema) {
  const systemPrompt = `
Role:  Senior React Developer and UI Designer.
Task: Generate a React component called \`PreviewApp\` based on the BA JSON, Activity Diagram, and Data Schema.

Requirements for the output:
Layout: Use a sidebar for navigation and a white-card-on-gray-background for content.
Styles: Use Tailwind exclusively. No external CSS.
1. Generate **valid JSX code** for a React functional component named \`PreviewApp\`.
2. Use React hooks (\`useState\`, \`useEffect\`, etc.) if needed.
3. Handle all actions mentioned in the Bajson.
4. Use **inline styles** provided in the Bajson.
5. Return the full component **ready to render inside a ReactDOM root**.
6. Do not include imports; assume React and ReactDOM are already available globally.
7. Wrap the component content in a full-screen container with the backgroundColor specified.
8. Ensure that any dynamic value references are correctly implemented in JSX.
9. Do not include any explanations, comments, or markdown formatting in the output. Only return the raw JSX code for the component.

\`\`\`jsx
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<PreviewApp />);
\`\`\`
Do NOT wrap the code in quotes, JSON, or any object. Return only raw executable JSX code.
Use correct React JSX syntax. For example, use {variable} inside JSX expressions instead of \${variable}.
Only respond with the React component code and the ReactDOM render call. No explanations.
`;

  const userPrompt = `
Activity Diagram:
${diagram}

Data Schema:
${schema}

BA JSON:
${JSON.stringify(baJson)}
`;
  // ... existing prompts ...

let rawResponse = await callGroq(systemPrompt, userPrompt);

// 1. Clean Markdown Fences (LLMs love adding them even if told not to)
rawResponse = rawResponse.replace(/```jsx|```javascript|```/g, "").trim();

// 2. Remove JSON wrapping if present
if (rawResponse.startsWith('"') && rawResponse.endsWith('"')) {
  try {
    rawResponse = JSON.parse(rawResponse);
  } catch(e) { 
    rawResponse = rawResponse.slice(1, -1); 
  }
}

// 3. Robust Extraction 
// Instead of a complex regex, just ensure we have the PreviewApp and a render call.
if (!rawResponse.includes("PreviewApp")) {
    return `const PreviewApp = () => <div style={{padding:20}}>AI returned invalid code format.</div>;
    const root = ReactDOM.createRoot(document.getElementById("root"));
    root.render(<PreviewApp />);`;
}

// Ensure there is a render call at the bottom
if (!rawResponse.includes("ReactDOM.createRoot")) {
    rawResponse += `\n\nconst root = ReactDOM.createRoot(document.getElementById("root"));\nroot.render(<PreviewApp />);`;
}

return rawResponse;
}
 
module.exports = {
  handleClarification,
  handleChange,
  generateDiagram,
  generateGherkin,
  generateSchema,
  generatePrototype
};



