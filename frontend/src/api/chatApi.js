const API_BASE = "http://localhost:5000/api";

/**
 * Robustly retrieves the auth token and cleans up common formatting issues.
 */
const getAuthHeader = () => {
  // Check both common naming conventions
  const token = localStorage.getItem("authToken") || localStorage.getItem("token");
  
  if (!token) return {};

  // Remove extra quotes if the token was stored as a JSON string
  const cleanToken = token.replace(/^"(.*)"$/, '$1').replace(/"/g, '');
  
  return { Authorization: `Bearer ${cleanToken}` };
};

// --- Conversation Management ---

export async function startNewConversation() {
  const res = await fetch(`${API_BASE}/chat/conversation`, {
    method: "POST",
    headers: getAuthHeader()
  });
  return res.json();
}

export async function getAllConversations() {
  const res = await fetch(`${API_BASE}/chat/conversations`, {
    headers: getAuthHeader()
  });
  return res.json();
}

export async function updateConversationTitle(conversationId, title) {
  const res = await fetch(`${API_BASE}/chat/conversation/${conversationId}/title`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader()
    },
    body: JSON.stringify({ title })
  });
  return res.json();
}

export async function toggleConversationPin(conversationId, isPinned) {
  const res = await fetch(`${API_BASE}/chat/conversation/${conversationId}/pin`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader()
    },
    body: JSON.stringify({ isPinned })
  });
  return res.json();
}

export async function deleteConversation(conversationId) {
  const res = await fetch(`${API_BASE}/chat/conversation/${conversationId}`, {
    method: "DELETE",
    headers: getAuthHeader()
  });
  return res.json();
}

export async function cleanupEmptyConversations() {
  const res = await fetch(`${API_BASE}/chat/cleanup-empty-conversations`, {
    method: "POST",
    headers: getAuthHeader()
  });
  if (!res.ok) {
    throw new Error(`Failed to cleanup: ${res.statusText}`);
  }
  return res.json();
}

// --- Messages & Diagrams ---

export async function sendMessage(conversationId, content) {
  const res = await fetch(`${API_BASE}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader()
    },
    body: JSON.stringify({ conversationId, content })
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || `Failed to send message: ${res.statusText}`);
  }
  return res.json();
}

export async function loadMessages(conversationId) {
  const res = await fetch(`${API_BASE}/chat/conversation/${conversationId}/messages`, {
    headers: getAuthHeader()
  });
  return res.json();
}

export async function loadDiagram(conversationId) {
  const res = await fetch(`${API_BASE}/chat/conversation/${conversationId}/activity-diagram`, {
    headers: getAuthHeader()
  });
  return res.json();
}

export async function fetchPrototype(conversationId) {
  const res = await fetch(`${API_BASE}/chat/conversation/${conversationId}/generate-prototype`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader()
    },
    credentials: 'include'
  });
  return res.json();
}


// --- Jira Integration ---

export async function exportToJira(conversationId) {
  const res = await fetch(`${API_BASE}/jira/export/${conversationId}`, {
    method: "POST",
    headers: getAuthHeader()
  });
  return res.json();
}

export async function checkJiraStatus(conversationId) {
  const headers = getAuthHeader();

  const res = await fetch(`${API_BASE}/jira/status/${conversationId}`, {
    headers
  });
  return res.json();
}