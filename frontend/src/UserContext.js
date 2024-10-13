import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// Create a UserContext
const UserContext = createContext(null);

// Custom hook to use the UserContext
export const useUser = () => useContext(UserContext);

// UserProvider component to wrap around your app
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Try to load user from localStorage on initial load
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(true);  // Loading state
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  // Helper function to check token expiration
  const isTokenExpired = (expiresAt) => {
    const currentTime = new Date().getTime();
    return expiresAt && currentTime >= new Date(expiresAt).getTime();
  };

  useEffect(() => {
    const checkUserSession = async () => {
      setLoading(true);  // Set loading to true when checking session
      try {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);

          // Check token expiration
          if (isTokenExpired(parsedUser.token_expires_at)) {
            // Token is expired, so log out user
            await logoutUser();
          } else {
            setUser(parsedUser);  // Set user if token is valid
          }
        } else {
          const response = await axios.get(`${backendUrl}/auth/status`, { withCredentials: true });
          if (response.data.logged_in) {
            setUser(response.data.user);
            localStorage.setItem('user', JSON.stringify(response.data.user));
          } else {
            setUser(null);
            localStorage.removeItem('user');
          }
        }
      } catch (error) {
        console.error('Error checking user session:', error);
        setUser(null);
        localStorage.removeItem('user');
      } finally {
        setLoading(false);  // Set loading to false after session check
      }
    };

    checkUserSession();
  }, [backendUrl]);

  const loginUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logoutUser = async () => {
    try {
      await axios.get(`${backendUrl}/auth/logout`, { withCredentials: true });
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('user');
    }
  };

  return (
    <UserContext.Provider value={{ user, loginUser, logoutUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};