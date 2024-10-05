import React, { useState } from 'react';
import axios from 'axios';
import { useUser } from '../UserContext';  // Import useUser correctly
import { useNavigate } from 'react-router-dom'; // Import useNavigate from react-router-dom

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const { loginUser } = useUser();  // Use loginUser from UserContext
  const navigate = useNavigate();  // Initialize useNavigate

  // Environment variable for backend URL
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      const response = await axios.post(`${backendUrl}/auth/login`, {
        email,
        password,
      }, {
        withCredentials: true,  // Ensure credentials are included in the request
      });

      if (response && response.data) {
        setMessage(response.data.message);
        if (response.data.message === 'Login successful') {
          loginUser({ email });  // Use loginUser to set user and store in localStorage
          navigate('/');  // Redirect to the dashboard after successful login
        }
      } else {
        setMessage('Login failed: Invalid response');
        console.error('Login failed: Invalid response');
      }
    } catch (error) {
      console.error('Login failed', error);
      setMessage('Login failed: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleGoogleLogin = () => {
    // Redirect the user to the Google OAuth login URL on the backend
    window.location.href = `${backendUrl}/auth/login/google`;
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h2>Login</h2>
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="login-button">Login</button>
        </form>

        <button className="gsi-material-button" onClick={handleGoogleLogin}>
          <div className="gsi-material-button-state"></div>
          <div className="gsi-material-button-content-wrapper">
            <div className="gsi-material-button-icon">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
            </div>
            <span className="gsi-material-button-contents">Sign in with Google</span>
            <span style={{ display: 'none' }}>Sign in with Google</span>
          </div>
        </button>

        {message && <p className="login-message">{message}</p>}
      </div>
    </div>
  );
};

export default LoginPage;