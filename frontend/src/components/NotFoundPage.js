// src/components/NotFoundPage.js

import React from 'react';
import { NavLink } from 'react-router-dom'; // Import NavLink
import { Button } from 'react-bootstrap'; // Optional: Import Button for navigation

const NotFoundPage = () => {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center" style={{ height: '80vh' }}>
      <h1>404 - Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <NavLink to="/">
        <Button variant="primary">Go to Dashboard</Button>
      </NavLink>
    </div>
  );
};

export default NotFoundPage;