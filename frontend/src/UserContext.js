// UserContext.js

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

  // Function to check user session on initial load
  useEffect(() => {
    const checkUserSession = async () => {
      console.log("[UserContext] Checking user session...");
      setLoading(true);  // Set loading to true when checking session
      try {
        const savedUser = localStorage.getItem('user');
        
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);

          // No token-based checks needed for session-based auth
          console.log("[UserContext] User data found in localStorage:", parsedUser);
          setUser(parsedUser);
        } else {
          // No saved user in localStorage, check with backend
          console.log("[UserContext] No user in localStorage. Checking with backend.");
          const response = await axios.get(`${backendUrl}/auth/status`, { withCredentials: true });
          console.log("[UserContext] Status API Response:", response.data); // Log the response data
          if (response.data.logged_in) {
            const userData = {
              ...response.data.user,
              company_id: response.data.user.company_id, // Ensure company_id is included
            };
            console.log("[UserContext] Fetched user data from status:", userData);
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
          } else {
            console.log("[UserContext] User is not logged in.");
            setUser(null);
            localStorage.removeItem('user');
          }
        }
      } catch (error) {
        console.error("[UserContext] Error checking user session:", error);
        setUser(null);
        localStorage.removeItem('user');
      } finally {
        setLoading(false);  // Set loading to false after session check
      }
    };
  
    checkUserSession();
  }, [backendUrl]);

  const loginUser = (userData) => {
    console.log("[UserContext] Logging in user:", userData);
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logoutUser = async () => {
    console.log("[UserContext] Logging out user:", user);
    try {
      const response = await axios.get(`${backendUrl}/auth/logout`, { withCredentials: true });
      console.log("[UserContext] Logout response:", response.data);
    } catch (error) {
      console.error("[UserContext] Error during logout:", error);
    } finally {
      setUser(null);
      localStorage.removeItem('user');
      console.log("[UserContext] User state cleared and localStorage updated.");
    }
  };

  return (
    <UserContext.Provider value={{ user, loginUser, logoutUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUserContext = () => useContext(UserContext);