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

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      const response = await axios.post('http://localhost:5000/auth/login', {
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
    <div>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <div>
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
        <div>
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
        <button type="submit">Login</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default LoginPage;