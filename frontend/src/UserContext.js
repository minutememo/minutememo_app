import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// Create a UserContext
const UserContext = createContext(null);

// Custom hook to use the UserContext
export const useUser = () => {
  return useContext(UserContext);
};

// UserProvider component to wrap around your app
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Try to load user from localStorage on initial load
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // Load user data when the component mounts
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        console.log("Checking user session...");
        const response = await axios.get('http://localhost:5000/auth/status', { withCredentials: true });
        console.log("Status response:", response.data);
        if (response.data.logged_in) {
          console.log("User is logged in, setting user context.");
          setUser(response.data.user);
          localStorage.setItem('user', JSON.stringify(response.data.user));
        } else {
          console.log("User is not logged in, clearing user context.");
          setUser(null);
          localStorage.removeItem('user');
        }
      } catch (error) {
        console.error('Error checking user session:', error);
        setUser(null);
        localStorage.removeItem('user');
      }
    };

    checkUserSession();
  }, []);

  // Function to log in the user
  const loginUser = (userData) => {
    console.log("Logging in user:", userData);
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logoutUser = async () => {
    console.log("Logging out user.");
    try {
      // Call the logout endpoint on the server to clear the session
      await axios.get('http://localhost:5000/auth/logout', { withCredentials: true });
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('user');
    }
  };

  return (
    <UserContext.Provider value={{ user, loginUser, logoutUser }}>
      {children}
    </UserContext.Provider>
  );
};