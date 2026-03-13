import React, { useState, useEffect } from 'react';
import '../styles/OTPVerification.css';

function OTPVerification({ email, onVerified, onBackToForm, mode = 'signup' }) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [canResend, setCanResend] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('http://localhost:5000/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code: otp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify OTP');
      }

      setSuccess('OTP verified successfully!');
      setTimeout(() => {
        onVerified(true);
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/auth/request-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend OTP');
      }

      setTimeLeft(600);
      setCanResend(false);
      setOtp('');
      setSuccess('OTP resent to your email');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="otp-verification-container">
      <div className="otp-card">
        <h2>Verify Your Email</h2>
        <p className="otp-email">We've sent a code to <strong>{email}</strong></p>

        <form onSubmit={handleVerifyOTP}>
          <div className="form-group">
            <label htmlFor="otp">Enter OTP Code</label>
            <input
              type="text"
              id="otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength="6"
              disabled={loading}
              className="otp-input"
              autoFocus
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button
            type="submit"
            disabled={loading || otp.length !== 6 || timeLeft <= 0}
            className="btn-verify"
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>

        <div className="otp-footer">
          <div className="timer">
            {timeLeft > 0 ? (
              <p>Code expires in: <strong>{formatTime(timeLeft)}</strong></p>
            ) : (
              <p className="expired">Code expired</p>
            )}
          </div>

          <div className="resend-section">
            {canResend || timeLeft <= 0 ? (
              <button
                onClick={handleResendOTP}
                disabled={loading}
                className="btn-resend"
              >
                Resend OTP
              </button>
            ) : (
              <p className="resend-hint">Didn't receive code? You can request a new one in {formatTime(timeLeft)}</p>
            )}
          </div>

          <button
            onClick={onBackToForm}
            className="btn-back"
          >
            Back to {mode === 'signup' ? 'Sign Up' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OTPVerification;
