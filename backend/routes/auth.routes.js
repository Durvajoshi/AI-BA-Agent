const express = require("express");
const router = express.Router();
const { signup, login, verifyToken, updateProfile, deleteProfile, getUserById, comparePassword } = require("../services/auth.service");
const { sendOTP, verifyOTP, markEmailVerified } = require("../services/otp.service");
const authMiddleware = require("../middleware/auth.middleware");



// Signup endpoint
router.post("/signup", async (req, res) => {
  try {
    const {
      email,
      password,
      fullName,
      jiraBaseUrl,
      jiraEmail,
      jiraApiToken,
      jiraLeadAccountId,
      otpVerified
    } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // STEP 1: Check if user already exists
    const existingUser = await require("../db/postgres").query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

    // STEP 2: If OTP not verified → send OTP only
    if (!otpVerified) {
      await sendOTP(email);

      return res.json({
        otpRequired: true,
        message: "OTP sent to email"
      });
    }

    // STEP 3: If OTP verified → create user
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

   const jiraCredentials = {};
if (jiraBaseUrl && jiraEmail && jiraApiToken && jiraLeadAccountId) {
  jiraCredentials.baseUrl = jiraBaseUrl;
  jiraCredentials.email = jiraEmail;
  jiraCredentials.apiToken = jiraApiToken;
  jiraCredentials.leadAccountId = jiraLeadAccountId;
}



    const { user, token } = await signup(
      email,
      password,
      fullName,
      jiraCredentials
    );

    res.json({
      user,
      token,
      message: "User created successfully"
    });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// Login endpoint
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const { user, token } = await login(email, password);

    res.json({
      user,
      token,
      message: "Login successful"
    });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Verify token endpoint
router.post("/verify", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Get full user data
    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        userId: decoded.userId,
        email: user.email,
        full_name: user.full_name,
        jira_base_url: user.jira_base_url,
        jira_email: user.jira_email,
        jira_lead_account_id: user.jira_lead_account_id
      }
    });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Update profile endpoint
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    console.log("PUT /profile endpoint hit");
    console.log("Request body:", req.body);
    console.log("User from middleware:", req.user);
    const { password, currentPassword, fullName, jiraBaseUrl, jiraEmail, jiraApiToken, jiraLeadAccountId } = req.body;
    const userId = req.user.userId;

    // If changing password, verify current password
    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password is required to change password" });
      }

      const user = await getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isPasswordValid = await comparePassword(currentPassword, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
    }

    const updatedUser = await updateProfile(userId, {
      password,
      fullName,
      jiraBaseUrl,
      jiraEmail,
      jiraApiToken,
      jiraLeadAccountId
    });

    res.json({
      user: updatedUser,
      message: "Profile updated successfully"
    });
  } catch (err) {
    console.error("Error in updateProfile:", err.message);
    res.status(400).json({ error: err.message });
  }
});

// Delete profile endpoint
router.delete("/profile", authMiddleware, async (req, res) => {
  try {
    console.log("DELETE /profile endpoint hit");
    console.log("Request body:", req.body);
    console.log("User from middleware:", req.user);
    const { password } = req.body;
    const userId = req.user.userId;

    if (!password) {
      return res.status(400).json({ error: "Password is required to delete account" });
    }

    // Verify password before deletion
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Password is incorrect" });
    }

    await deleteProfile(userId);

    res.json({
      success: true,
      message: "Account deleted successfully"
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Request OTP endpoint
router.post("/request-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const result = await sendOTP(email);

    res.json({
      success: true,
      message: "OTP sent to email",
      expiresAt: result.expiresAt
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Verify OTP endpoint
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: "Email and OTP code are required" });
    }

    const result = await verifyOTP(email, code);

    res.json({
      success: true,
      message: "OTP verified successfully"
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mark email as verified endpoint (called after OTP verification)
router.post("/mark-email-verified", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await markEmailVerified(userId);

    res.json({
      success: true,
      message: "Email marked as verified"
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// Forgot Password - Step 1: Request OTP
router.post("/forgot-password-request", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    // Verify user exists first
    const userResult = await require("../db/postgres").query("SELECT id FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "No account found with this email" });
    }

    await sendOTP(email);
    res.json({ success: true, message: "Reset OTP sent to email" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Forgot Password - Step 2: Reset Password with OTP
router.post("/forgot-password-reset", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "Email, code, and new password are required" });
    }

    // 1. Verify OTP
    await verifyOTP(email, code);

    // 2. Update Password
    const userResult = await require("../db/postgres").query("SELECT id FROM users WHERE email = $1", [email]);
    const userId = userResult.rows[0].id;
    
    await updateProfile(userId, { password: newPassword });

    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
module.exports = router;
