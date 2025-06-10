import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Extract path and query parameters from the hash
    const hash = window.location.hash;
    const hashContent = hash.substring(1); // Remove the leading #
    const hashParts = hashContent.split('?');
    const pathInHash = hashParts[0];
    const queryInHash = hashParts.length > 1 ? hashParts[1] : '';

    const params = new URLSearchParams(queryInHash);
    const token = params.get('token1'); // Assuming token1 is the session token

    if (token) {
      localStorage.setItem('deriv_token', token);
      alert('Login successful!'); // For demonstration, you might redirect to a dashboard
      navigate('/dashboard'); // Redirect to dashboard after login
    } else {
      alert('Login failed or no token received.');
      navigate('/'); // Redirect to home or login on failure
    }
  }, [navigate]);

  return (
    <div>
      <p>Processing Deriv login...</p>
    </div>
  );
};

export default OAuthCallback; 