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
        {message && <p className="login-message">{message}</p>}
      </div>
    </div>
  );
};

export default LoginPage;