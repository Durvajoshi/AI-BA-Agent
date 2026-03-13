import { useContext, useState } from "react";
import { signup } from "../api/authApi";
import { AuthContext } from "../context/AuthContext";
import OTPVerification from "./OTPVerification";
import "../styles/Auth.css";

export function Signup({ onSwitchToLogin }) {
  const { login: setAuth } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [signupData, setSignupData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

   

    setLoading(true);

    try {
  const response = await fetch('http://localhost:5000/api/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      fullName,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Signup failed');
  }

  if (data.otpRequired) {
    setSignupData({
      email,
      password,
      fullName,
      
    });

    setShowOTP(true);
  }

} catch (err) {
  setError(err.message || "Failed to initiate signup");
}
 finally {
      setLoading(false);
    }
  };

  const handleOTPVerified = async () => {
  setLoading(true);

  try {
    // Now complete the signup
    const response = await fetch('http://localhost:5000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: signupData.email,
        password: signupData.password,
        fullName: signupData.fullName,
        otpVerified: true, // ✅ IMPORTANT
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Signup failed after OTP verification");
    }

    // Set auth and redirect
    setAuth(result.user, result.token);

  } catch (err) {
    setError(err.message || "Signup failed after OTP verification");
    setShowOTP(false);
  } finally {
    setLoading(false);
  }
};


  const handleBackToForm = () => {
    setShowOTP(false);
    setSignupData(null);
  };

  return (
    <>
      {showOTP ? (
        <OTPVerification
          email={signupData.email}
          onVerified={handleOTPVerified}
          onBackToForm={handleBackToForm}
          mode="signup"
        />
      ) : (
        <div className="auth-container">
          <div className="auth-card" style={{ maxWidth: "520px" }}>
            <h1 className="auth-title">BA Agent</h1>
            <p className="auth-subtitle">Create your account</p>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
          <div style={sectionStyles.section}>
            <h3 style={sectionStyles.sectionTitle}>Account Details</h3>
            
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                disabled={loading}
                className="form-input"
              />
            </div>

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
              <p style={sectionStyles.hint}>At least 6 characters</p>
            </div>
          </div>


          <button
            type="submit"
            disabled={loading}
            className="auth-button"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{" "}
          <button
            onClick={onSwitchToLogin}
            className="auth-switch-trigger"
            disabled={loading}
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
      )}
    </>
  );
}

const sectionStyles = {
  section: {
    marginBottom: "24px",
    paddingBottom: "24px",
    borderBottom: "1px solid #d0d7de"
  },
  sectionTitle: {
    margin: "0 0 16px 0",
    fontSize: "14px",
    fontWeight: "600",
    color: "#161b22"
  },
  hint: {
    margin: "6px 0 0 0",
    fontSize: "12px",
    color: "#8c959b",
    fontStyle: "italic"
  }
};
