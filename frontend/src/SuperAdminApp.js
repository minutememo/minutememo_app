import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SuperAdminLoginPage from './components/SuperAdminLoginPage';
import SuperAdminDashboard from './components/SuperAdminDashboard';

const SuperAdminApp = () => {
  return (
    <Router>
      <Routes>
        <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
        <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
      </Routes>
    </Router>
  );
};

export default SuperAdminApp;