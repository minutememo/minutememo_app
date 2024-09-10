import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext';

const SuperAdminLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(''); // Renaming from error to message for consistency
  const navigate = useNavigate();
  const { loginUser } = useUser();

  useEffect(() => {
    console.log("SuperAdminLoginPage component loaded");
  }, []);

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
  
    try {
      const response = await axios.post(`${backendUrl}/auth/login`, { email, password });
  
      // Check if the internal_user_role is 'super_admin'
      if (response.data.internal_user_role === 'super_admin') {
        // Set the user in the context
        loginUser({
          email: response.data.email,
          internal_user_role: response.data.internal_user_role, // pass all the required fields
        });
  
        console.log("Super admin login successful, navigating to dashboard...");
        navigate('/superadmin/dashboard');  // Redirect to Super Admin Dashboard
      } else {
        setMessage('You do not have Super Admin access.');
      }
    } catch (err) {
      console.error("Login failed", err);
      setMessage('Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h2>Admin portal</h2>
        <form onSubmit={handleSubmit} className="login-form">
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
        {message && <p className="login-message">{message}</p>}  {/* Display the message if it exists */}
      </div>
    </div>
  );
};

export default SuperAdminLoginPage;