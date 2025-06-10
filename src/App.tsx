import React from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import OAuthCallback from './OAuthCallback';

function App() {
  const handleDerivLogin = () => {
    const app_id = '71979'; // Replace with your actual Deriv App ID
    window.location.href = `https://oauth.deriv.com/oauth2/authorize?app_id=${app_id}`;
  };

  return (
    <div className="App">
      <Routes>
        <Route path="/" element={
          <div className="login-card">
            <h2>Login</h2>
            
            <button className="sign-in-button" onClick={handleDerivLogin}>Login with Deriv</button>
            <p className="or-continue-with">or continue with</p>
            <button className="google-sign-in">
              <img src="https://img.icons8.com/color/16/000000/google-logo.png" alt="Google logo" />
              
            </button>
            <p className="register-text">
              Don't have an account yet? <a href="#">Register for free</a>
            </p>
          </div>
        } />
        <Route path="/oauth-callback" element={<OAuthCallback />} />
      </Routes>
    </div>
  );
}

export default App;
