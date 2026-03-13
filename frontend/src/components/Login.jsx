import { useContext, useState } from "react";
import { login } from "../api/authApi";
import { AuthContext } from "../context/AuthContext";
import OTPVerification from "./OTPVerification";
import "../styles/Auth.css";

import { ForgotPassword } from "./ForgotPassword";

export function Login({ onSwitchToSignup, onSwitchToForgot }) {
  const { login: setAuth } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [loginData, setLoginData] = useState(null);

const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");
  setLoading(true);

  try {
    const result = await login(email, password);
    setAuth(result.user, result.token);
  } catch (err) {
    setError(err.message || "Login failed");
  } finally {
    setLoading(false);
  }
};


  const handleOTPVerified = async () => {
    setLoading(true);

    try {
      // Now complete the login
      const result = await login(loginData.email, loginData.password);
      setAuth(result.user, result.token);
    } catch (err) {
      setError(err.message || "Login failed after OTP verification");
      setShowOTP(false);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToForm = () => {
    setShowOTP(false);
    setLoginData(null);
  };

  return (
    <>
       
        <div className="auth-container">
          <div className="auth-card">
            <h1 className="auth-title">BA Agent</h1>
            <p className="auth-subtitle">Sign in to your account</p>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={loading}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              className="form-input"
            />
          </div>

          <div style={{ textAlign: "right", marginTop: "-10px", marginBottom: "15px" }}>
  <button
    type="button"
    onClick={() => onSwitchToForgot()} // We will add this prop in App.jsx
    style={{ background: "none", border: "none", color: "#0052CC", fontSize: "12px", cursor: "pointer" }}
  >
    Forgot Password?
  </button>
</div>

          <button
            type="submit"
            disabled={loading}
            className="auth-button"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account?{" "}
          <button
            onClick={onSwitchToSignup}
            className="auth-switch-trigger"
            disabled={loading}
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
      
    </>
  );
}
