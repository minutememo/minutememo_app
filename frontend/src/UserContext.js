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

  // Function to refresh the access token
  const refreshToken = async () => {
    if (!user) return null; // Return early if user is not defined
    try {
      const response = await axios.post(`${backendUrl}/auth/refresh-token`, {
        refresh_token: user.refresh_token,
      });
      if (response.status === 200) {
        const newAccessToken = response.data.access_token;
        const tokenExpiresAt = response.data.token_expires_at; // Get token expiration info from the backend
        // Update user with new token
        const updatedUser = { ...user, access_token: newAccessToken, token_expires_at: tokenExpiresAt };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        return newAccessToken;
      } else {
        console.error('Failed to refresh token');
      }
    } catch (error) {
      console.error('Error refreshing token', error);
    }
    return null;
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
            // Token is expired, try to refresh it
            const newToken = await refreshToken();
            if (!newToken) {
              // If refreshing token fails, log out user
              await logoutUser();
            } else {
              // If token was refreshed, update the user with the new token
              const refreshedUser = { ...parsedUser, access_token: newToken };
              setUser(refreshedUser);
              localStorage.setItem('user', JSON.stringify(refreshedUser));
            }
          } else {
            setUser(parsedUser);  // Set user if token is valid
          }
        } else {
          // No saved user in localStorage, check with backend
          const response = await axios.get(`${backendUrl}/auth/status`, { withCredentials: true });
          console.log('Status API Response:', response.data); // Log the response data
          if (response.data.logged_in) {
            const userData = {
              ...response.data.user,
              company_id: response.data.user.company_id, // Ensure company_id is included
            };
            console.log('Fetched user data from status:', userData);
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
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
    <UserContext.Provider value={{ user, loginUser, logoutUser, refreshToken, loading }}>
      {children}
    </UserContext.Provider>
  );
};