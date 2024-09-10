import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App'; // Main app for regular users
import SuperAdminApp from './SuperAdminApp'; // Super admin app
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Conditionally render SuperAdminApp if the URL starts with '/superadmin'
if (window.location.pathname.startsWith('/superadmin')) {
  root.render(
    <React.StrictMode>
      <SuperAdminApp />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

reportWebVitals();