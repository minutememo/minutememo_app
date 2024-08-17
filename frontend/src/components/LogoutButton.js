import React from 'react';
import { useUser } from '../UserContext';
import { Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const LogoutButton = () => {
  const { logoutUser } = useUser();  // Get the logout function from the context
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutUser();  // Call the logout function
    navigate('/login');  // Redirect to login page after logout
  };

  return (
    <Button variant="outline-danger" onClick={handleLogout}>
      Logout
    </Button>
  );
};

export default LogoutButton;