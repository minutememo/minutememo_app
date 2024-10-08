import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const SignupPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  const navigate = useNavigate();

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  const handleSignup = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (password !== passwordConfirm) {
      setError('Passwords do not match');
      return;
    }

    try {
      const response = await axios.post(`${backendUrl}/auth/signup`, {
        email,
        password,
        password_confirmation: passwordConfirm,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: true,  // Ensure credentials are included in the request
      });

      if (response && response.data) {
        setMessage('Signup successful! You are now logged in.');

        // Trigger a full page reload after navigating
        navigate('/dashboard');  // Update this to the path of your dashboard or home page
        window.location.reload(); // Force a full page reload
      } else {
        setError('Signup failed: Invalid response');
      }
    } catch (error) {
      setError('Signup failed: ' + (error.response?.data?.message || error.message));
    }
  };

  return (
    <div>
      <h2>Sign Up</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}
      <form onSubmit={handleSignup}>
        <div>
          <label htmlFor="email">Email:</label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password:</label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="passwordConfirm">Confirm Password:</label>
          <input
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
          />
        </div>
        <button type="submit">Sign Up</button>
      </form>
    </div>
  );
};

export default SignupPage;