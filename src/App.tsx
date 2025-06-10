import React from 'react';
import './App.css';

function App() {
  const handleDerivLogin = () => {
    const app_id = 'YOUR_APP_ID'; // Replace with your actual Deriv App ID
    window.location.href = `https://oauth.deriv.com/oauth2/authorize?app_id=${app_id}`;
  };

  return (
    <div className="App">
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
    </div>
  );
}

export default App;
