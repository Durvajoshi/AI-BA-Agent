const API_BASE = "http://localhost:5000/api/auth";

export async function signup(email, password, fullName, jiraBaseUrl, jiraEmail, jiraApiToken, jiraLeadAccountId) {
  const res = await fetch(`${API_BASE}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      email, 
      password, 
      fullName,
      jiraBaseUrl,
      jiraEmail,
      jiraApiToken,
      jiraLeadAccountId
    })
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Signup failed");
  }
  
  return res.json();
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Login failed");
  }
  
  return res.json();
}

export async function verifyToken(token) {
  const res = await fetch(`${API_BASE}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });
  
  if (!res.ok) {
    throw new Error("Token verification failed");
  }
  
  return res.json();
}
export async function updateProfile(profileData) {
  const token = localStorage.getItem("authToken");
  
  if (!token) {
    throw new Error("Authentication required. Please login again.");
  }

  const url = `${API_BASE}/profile`;
  console.log("updateProfile called");
  console.log("API_BASE:", API_BASE);
  console.log("Full URL:", url);
  console.log("Method: PUT");
  console.log("Token:", token.substring(0, 20) + "...");
  console.log("Data being sent:", profileData);

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(profileData)
  });
  
  console.log("Response status:", res.status);
  console.log("Response statusText:", res.statusText);
  console.log("Response headers:", {
    'content-type': res.headers.get('content-type'),
    'content-length': res.headers.get('content-length')
  });
  
  if (!res.ok) {
    try {
      const error = await res.json();
      console.log("Error response:", error);
      throw new Error(error.error || `Failed to update profile (${res.status})`);
    } catch (parseError) {
      console.log("Parse error:", parseError);
      throw new Error(`Failed to update profile: ${res.statusText} (${res.status})`);
    }
  }
  
  try {
    return await res.json();
  } catch (parseError) {
    throw new Error("Invalid response from server");
  }
}

export async function deleteProfile(password) {
  const token = localStorage.getItem("authToken");
  
  if (!token) {
    throw new Error("Authentication required. Please login again.");
  }

  console.log("deleteProfile called");
  console.log("Token available:", !!token);

  const res = await fetch(`${API_BASE}/profile`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ password })
  });
  
  console.log("Response status:", res.status);
  console.log("Response ok:", res.ok);
  
  if (!res.ok) {
    try {
      const error = await res.json();
      console.error("Backend error response:", error);
      throw new Error(error.error || `Failed to update profile (${res.status})`);
    } catch (parseError) {
      console.error("Failed to parse error response:", parseError);
      throw new Error(`Failed to delete profile: ${res.statusText} (${res.status})`);
    }
  }
  
  try {
    return await res.json();
  } catch (parseError) {
    throw new Error("Invalid response from server");
  }
}
export async function requestPasswordReset(email) {
  const res = await fetch(`${API_BASE}/forgot-password-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to send reset code");
  }
  return res.json();
}

export async function completePasswordReset(email, code, newPassword) {
  const res = await fetch(`${API_BASE}/forgot-password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, newPassword })
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Reset failed");
  }
  return res.json();
}