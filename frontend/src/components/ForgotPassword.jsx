import { useState } from "react";
import { requestPasswordReset, completePasswordReset } from "../api/authApi";
import "../styles/Auth.css";

export function ForgotPassword({ onBackToLogin }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ email: "", code: "", newPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestPasswordReset(formData.email);
      setStep(2);
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await completePasswordReset(formData.email, formData.code, formData.newPassword);
      alert("Password updated! Please login.");
      onBackToLogin();
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Reset Password</h1>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={step === 1 ? handleRequest : handleReset} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" disabled={step === 2} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
          </div>
          {step === 2 && (
            <>
              <div className="form-group">
                <label className="form-label">OTP Code</label>
                <input className="form-input" type="text" placeholder="6-digit code" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-input" type="password" value={formData.newPassword} onChange={e => setFormData({...formData, newPassword: e.target.value})} required />
              </div>
            </>
          )}
          <button className="auth-button" type="submit" disabled={loading}>
            {loading ? "Processing..." : step === 1 ? "Send Reset OTP" : "Update Password"}
          </button>
        </form>
        <p className="auth-footer"><button onClick={onBackToLogin} className="auth-switch-trigger">Back to Login</button></p>
      </div>
    </div>
  );
}