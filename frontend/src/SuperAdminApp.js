import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SuperAdminLoginPage from './components/SuperAdminLoginPage';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import { UserProvider } from './UserContext';  // Import UserProvider

const SuperAdminApp = () => {
  return (
    <UserProvider>  {/* Wrap the app with UserProvider to provide context */}
      <Router>
        <Routes>
          <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
          <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
        </Routes>
      </Router>
    </UserProvider>
  );
};

export default SuperAdminApp;