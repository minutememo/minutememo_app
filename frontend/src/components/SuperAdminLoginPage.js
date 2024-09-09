import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const SuperAdminLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await axios.post(`${backendUrl}/auth/login`, {
        email,
        password,
      });

      if (response.data.role === 'super_admin') {
        // Navigate to the Super Admin Dashboard on successful login
        navigate('/superadmin/dashboard');
      } else {
        setError('You do not have Super Admin access.');
      }
    } catch (err) {
      console.error(err);
      setError('Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="login-container">
      <h2>Super Admin Login</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Login</button>
      </form>
      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default SuperAdminLoginPage;