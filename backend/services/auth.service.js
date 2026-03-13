const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const pool = require("../db/postgres");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRY = "7d";

// Hash password
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Compare password
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Generate JWT token
function generateToken(userId, email) {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// User signup
async function signup(email, password, fullName, jiraCredentials = {}) {
  try {
    // Check if user already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error("User already exists");
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user with Jira credentials
    const userId = uuidv4();
    const result = await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, jira_base_url, jira_email, jira_api_token, jira_lead_account_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, full_name, jira_base_url, jira_email, jira_lead_account_id`,
      [userId, email, passwordHash, fullName || email.split("@")[0], jiraCredentials.baseUrl, jiraCredentials.email, jiraCredentials.apiToken, jiraCredentials.leadAccountId]
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.email);

    return { user, token };
  } catch (err) {
    throw new Error(err.message);
  }
}

// User login
async function login(email, password) {
  try {
    // Find user
    const result = await pool.query(
      "SELECT id, email, password_hash, full_name, jira_base_url, jira_email, jira_lead_account_id FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error("Invalid email or password");
    }

    const user = result.rows[0];

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    const token = generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        jira_base_url: user.jira_base_url,
        jira_email: user.jira_email,
        jira_lead_account_id: user.jira_lead_account_id
      },
      token
    };
  } catch (err) {
    throw new Error(err.message);
  }
}

// Get user by ID
async function getUserById(userId) {
  try {
    const result = await pool.query(
      "SELECT id, email, password_hash, full_name, created_at, jira_base_url, jira_email, jira_api_token, jira_lead_account_id FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (err) {
    throw new Error(err.message);
  }
}

// Update user profile
async function updateProfile(userId, { email, password, fullName, jiraBaseUrl, jiraEmail, jiraApiToken, jiraLeadAccountId }) {
  try {
    // Check if new email is already taken by another user
    if (email) {
      const existingEmail = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND id != $2",
        [email, userId]
      );
      if (existingEmail.rows.length > 0) {
        throw new Error("Email already in use");
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (email) {
      updates.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }

    if (password) {
      const passwordHash = await hashPassword(password);
      updates.push(`password_hash = $${paramCount}`);
      values.push(passwordHash);
      paramCount++;
    }

    if (fullName) {
      updates.push(`full_name = $${paramCount}`);
      values.push(fullName);
      paramCount++;
    }

    if (jiraBaseUrl) {
      updates.push(`jira_base_url = $${paramCount}`);
      values.push(jiraBaseUrl);
      paramCount++;
    }

    if (jiraEmail) {
      updates.push(`jira_email = $${paramCount}`);
      values.push(jiraEmail);
      paramCount++;
    }

    if (jiraApiToken) {
      updates.push(`jira_api_token = $${paramCount}`);
      values.push(jiraApiToken);
      paramCount++;
    }

    if (jiraLeadAccountId) {
      updates.push(`jira_lead_account_id = $${paramCount}`);
      values.push(jiraLeadAccountId);
      paramCount++;
    }

    if (updates.length === 0) {
      throw new Error("No fields to update");
    }

    // Add userId as last parameter
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${updates.join(", ")}
      WHERE id = $${paramCount}
      RETURNING id, email, full_name, jira_base_url, jira_email, jira_lead_account_id
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error("User not found");
    }

    return result.rows[0];
  } catch (err) {
    throw new Error(err.message);
  }
}

// Delete user profile
async function deleteProfile(userId) {
  try {
    // Delete all related data for this user
    const conversations = await pool.query(
      "SELECT id FROM conversations WHERE user_id = $1",
      [userId]
    );

    const conversationIds = conversations.rows.map(c => c.id);

    if (conversationIds.length > 0) {
      // Delete jira_issues
      await pool.query(
        `DELETE FROM jira_issues 
         WHERE ba_version_id IN (
           SELECT v.id FROM ba_versions v
           JOIN ba_documents d ON v.ba_document_id = d.id
           WHERE d.conversation_id = ANY($1)
         )`,
        [conversationIds]
      );

      // Delete activity_diagrams
      await pool.query(
        `DELETE FROM activity_diagrams 
         WHERE ba_version_id IN (
           SELECT v.id FROM ba_versions v
           JOIN ba_documents d ON v.ba_document_id = d.id
           WHERE d.conversation_id = ANY($1)
         )`,
        [conversationIds]
      );

      // Delete ba_versions
      await pool.query(
        `DELETE FROM ba_versions 
         WHERE ba_document_id IN (
           SELECT id FROM ba_documents WHERE conversation_id = ANY($1)
         )`,
        [conversationIds]
      );

      // Delete ba_documents
      await pool.query(
        "DELETE FROM ba_documents WHERE conversation_id = ANY($1)",
        [conversationIds]
      );

      // Delete messages
      await pool.query(
        "DELETE FROM messages WHERE conversation_id = ANY($1)",
        [conversationIds]
      );

      // Delete conversations
      await pool.query(
        "DELETE FROM conversations WHERE user_id = $1",
        [userId]
      );
    }

    // Delete user
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    return { success: true };
  } catch (err) {
    throw new Error(err.message);
  }
}

module.exports = {
  signup,
  login,
  getUserById,
  updateProfile,
  deleteProfile,
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword
};
