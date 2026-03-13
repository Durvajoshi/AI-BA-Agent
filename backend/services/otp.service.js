const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/postgres');

// Initialize email transporter with trimmed environment variables
const emailUser = (process.env.EMAIL_USER || '').trim();
const emailPassword = (process.env.EMAIL_PASSWORD || '').trim();
const emailService = (process.env.EMAIL_SERVICE || 'gmail').trim();

if (!emailUser || !emailPassword) {
  console.warn('⚠️  Warning: EMAIL_USER or EMAIL_PASSWORD not configured. OTP emails will fail.');
  console.warn('Please set EMAIL_USER and EMAIL_PASSWORD in your .env file.');
}

const transporter = nodemailer.createTransport({
  service: emailService,
  auth: {
    user: emailUser,
    pass: emailPassword,
  },
});

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP via email
async function sendOTP(email) {
  try {
    // Generate OTP
    const otp = generateOTP();
    
    // Calculate expiry time (default 10 minutes)
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    console.log(`📧 Sending OTP to ${email}...`);

    // Save OTP to database
    await pool.query(
      `INSERT INTO otp_codes (email, code, expires_at)
       VALUES ($1, $2, $3)`,
      [email, otp, expiresAt]
    );

    // Send email
    const mailOptions = {
      from: emailUser,
      to: email,
      subject: 'Your OTP Code for Email Verification',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Email Verification</h2>
          <p>Your One-Time Password (OTP) is:</p>
          <h1 style="color: #007bff; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
          <p>This code will expire in ${expiryMinutes} minutes.</p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP sent successfully to ${email}`);

    return {
      success: true,
      message: 'OTP sent to email',
      expiresAt,
    };
  } catch (err) {
    console.error('❌ Error sending OTP:', err.message);
    throw new Error('Failed to send OTP: ' + err.message);
  }
}

// Verify OTP
async function verifyOTP(email, code) {
  try {
    // Find the latest OTP for this email
    const result = await pool.query(
      `SELECT id, code, expires_at FROM otp_codes
       WHERE email = $1 AND is_verified = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error('No OTP found. Please request a new one.');
    }

    const otpRecord = result.rows[0];

    // Check if OTP has expired
    if (new Date() > new Date(otpRecord.expires_at)) {
      throw new Error('OTP has expired. Please request a new one.');
    }

    // Check if code matches
    if (otpRecord.code !== code.toString()) {
      throw new Error('Invalid OTP code.');
    }

    // Mark OTP as verified
    await pool.query(
      `UPDATE otp_codes SET is_verified = true WHERE id = $1`,
      [otpRecord.id]
    );

    return {
      success: true,
      message: 'OTP verified successfully',
    };
  } catch (err) {
    console.error('Error verifying OTP:', err.message);
    throw new Error(err.message);
  }
}

// Mark user email as verified
async function markEmailVerified(userId) {
  try {
    await pool.query(
      `UPDATE users 
       SET email_verified = true, email_verified_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId]
    );

    return {
      success: true,
      message: 'Email marked as verified',
    };
  } catch (err) {
    console.error('Error marking email as verified:', err.message);
    throw new Error(err.message);
  }
}

// Clean up expired OTPs (run periodically)
async function cleanupExpiredOTPs() {
  try {
    const result = await pool.query(
      `DELETE FROM otp_codes WHERE expires_at < CURRENT_TIMESTAMP`
    );

    console.log(`Cleaned up ${result.rowCount} expired OTPs`);
    return { deletedCount: result.rowCount };
  } catch (err) {
    console.error('Error cleaning up expired OTPs:', err.message);
    throw new Error(err.message);
  }
}

module.exports = {
  sendOTP,
  verifyOTP,
  markEmailVerified,
  cleanupExpiredOTPs,
  generateOTP,
};
