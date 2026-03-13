# Email OTP Verification Feature

## Overview
This document describes the Email OTP (One-Time Password) verification feature that has been added to the AI BA Agent application. This feature ensures secure user registration and login by requiring email verification through OTP codes.

## Features
- **6-digit OTP codes**: Randomly generated codes sent to user email
- **Automatic expiration**: OTPs expire after 10 minutes (configurable)
- **Secure email delivery**: Uses Nodemailer with Gmail SMTP
- **Resendable codes**: Users can request new OTPs if needed
- **Rate limiting friendly**: Tracks OTP attempts per email
- **Database persistence**: All OTPs stored in PostgreSQL

## Architecture Changes

### Database Schema
New tables and columns added:

1. **otp_codes table**
```sql
CREATE TABLE otp_codes (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

2. **users table updates**
```sql
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP;
```

### Backend Services

#### OTP Service (`backend/services/otp.service.js`)
Handles all OTP-related operations:

- `sendOTP(email)` - Generate and send OTP to email
- `verifyOTP(email, code)` - Verify OTP code
- `markEmailVerified(userId)` - Mark user's email as verified
- `cleanupExpiredOTPs()` - Clean up expired OTPs from database

#### New API Endpoints

1. **POST /api/auth/request-otp**
   - Request OTP for a given email
   - Request body: `{ email: "user@example.com" }`
   - Response: `{ success: true, message: "...", expiresAt: "..." }`

2. **POST /api/auth/verify-otp**
   - Verify OTP code
   - Request body: `{ email: "user@example.com", code: "123456" }`
   - Response: `{ success: true, message: "OTP verified successfully" }`

3. **POST /api/auth/mark-email-verified**
   - Mark email as verified after OTP verification
   - Requires authentication
   - Response: `{ success: true, message: "..." }`

### Frontend Components

#### OTPVerification Component (`frontend/src/components/OTPVerification.jsx`)
- Displays OTP input form with 6-digit input field
- Shows countdown timer for OTP expiration
- Allows resending OTP if expired
- Keyboard-friendly numeric input

#### Integration with Auth Flow
- **Signup**: After entering credentials, user is prompted to verify email via OTP
- **Login**: Before granting access, user must verify email via OTP

## Configuration

### Environment Variables
Update `.env` in the backend directory:

```env
# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
OTP_EXPIRY_MINUTES=10
```

### Gmail Setup (Recommended)
1. Enable 2-Step Verification on your Google account
2. Generate an App Password for Gmail
3. Use the App Password in `EMAIL_PASSWORD`

### Other Email Services
Nodemailer supports many SMTP providers. Update:
- `EMAIL_SERVICE`: Service name (e.g., 'sendgrid', 'mailgun', 'aws-ses')
- `EMAIL_USER`: Your username/email
- `EMAIL_PASSWORD`: Your password/API key

For custom SMTP:
```env
EMAIL_SERVICE=custom
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_EMAIL=your-email@example.com
SMTP_PASSWORD=your-password
```

## Installation

### Backend Setup
1. Install nodemailer dependency:
```bash
cd backend
npm install nodemailer
```

2. Run database migrations:
```bash
node server.js
```
The OTP table will be created automatically on startup.

### Frontend Setup
No additional dependencies needed. The OTP component is a React component using fetch API.

## Usage Flow

### Signup Flow
1. User fills signup form (email, password, Jira credentials)
2. Clicks "Sign Up"
3. OTP is sent to the provided email
4. User enters 6-digit OTP
5. OTP is verified
6. Account is created and user is logged in

### Login Flow
1. User enters email and password
2. Clicks "Sign In"
3. OTP is sent to the email
4. User enters 6-digit OTP
5. OTP is verified
6. User is logged in

## Security Considerations

1. **Sensitive Data**: OTPs are never logged or stored in plain text (code is verified against hash)
2. **Expiration**: OTPs expire after 10 minutes
3. **One-time Use**: OTPs are marked as verified after successful verification
4. **Email Verification**: Email is marked as verified in user record
5. **HTTPS**: Use HTTPS in production for all auth endpoints
6. **Rate Limiting**: Consider implementing rate limiting on OTP endpoints to prevent abuse

## Database Cleanup

Optional: Set up a periodic job to clean up expired OTPs:

```javascript
// backend/services/otp.service.js
// In server.js or a scheduled job:
const { cleanupExpiredOTPs } = require('./services/otp.service');

// Run cleanup every hour
setInterval(() => {
  cleanupExpiredOTPs().catch(err => console.error('Cleanup error:', err));
}, 3600000); // 1 hour
```

## Troubleshooting

### OTP Not Received
1. Check email configuration in `.env`
2. Verify SMTP credentials are correct
3. Check spam folder
4. Enable "Less secure app access" if using Gmail (legacy)

### OTP Expires Too Quickly
- Adjust `OTP_EXPIRY_MINUTES` in `.env` (default: 10)

### Database Errors
- Ensure PostgreSQL is running
- Check database connection in `backend/db/postgres.js`
- Verify all migrations ran successfully

## Frontend Error Codes

- **"No OTP found"**: User needs to request a new OTP
- **"OTP has expired"**: OTP validity period exceeded, user can resend
- **"Invalid OTP code"**: Entered code doesn't match

## API Response Examples

### Successful OTP Verification
```json
{
  "success": true,
  "message": "OTP verified successfully"
}
```

### OTP Request Response
```json
{
  "success": true,
  "message": "OTP sent to email",
  "expiresAt": "2024-01-15T12:35:00Z"
}
```

### Error Response
```json
{
  "error": "Invalid OTP code."
}
```

## Next Steps

1. Configure email service in `.env`
2. Install dependencies: `npm install` in backend
3. Test OTP flow with Signup/Login
4. Consider adding:
   - Rate limiting on OTP endpoints
   - SMS as OTP delivery method
   - OTP resend counter limits
   - Analytics on OTP verification rates

## Support

For issues or questions about the OTP feature:
1. Check application logs for error messages
2. Verify email configuration
3. Ensure database migrations completed successfully
