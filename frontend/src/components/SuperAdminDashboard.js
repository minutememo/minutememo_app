import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useUser } from '../UserContext';  // Import the user context hook

const SuperAdminDashboard = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();
  const { user } = useUser() || {};  // Safely destructure user, handle null case
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    if (!user || user.internal_user_role !== 'super_admin') {
      console.log("User not found or not super_admin, redirecting to login...");
      navigate('/superadmin/login');
      return;
    }

    const fetchCompanies = async () => {
      try {
        console.log("Fetching companies...");
        const response = await axios.get(`${backendUrl}/api/companies`, { withCredentials: true });
        setCompanies(response.data.companies);
      } catch (err) {
        console.error('Error fetching companies:', err);
      }
    };

    fetchCompanies();
  }, [backendUrl, navigate, user]);

  const handleCompanyClick = async (companyId) => {
    try {
      console.log(`Fetching users for company ${companyId}...`);
      const response = await axios.get(`${backendUrl}/api/companies/${companyId}/users`, { withCredentials: true });
      setSelectedCompany(companyId);
      setUsers(response.data.users);
    } catch (err) {
      console.error('Error fetching users for company:', err);
    }
  };

  if (!user) {
    return <p>Loading...</p>;  // Show a loading message if the user is not loaded yet
  }

  return (
    <div className="admin-dashboard">
      <h2>Super Admin Dashboard</h2>
      <div className="company-list">
        <h3>Companies</h3>
        <ul>
          {companies.map((company) => (
            <li key={company.id} onClick={() => handleCompanyClick(company.id)}>
              {company.name}
            </li>
          ))}
        </ul>
      </div>

      {selectedCompany && (
        <div className="user-list">
          <h3>Users for Company ID: {selectedCompany}</h3>
          <ul>
            {users.map((user) => (
              <li key={user.id}>{user.first_name} {user.last_name} ({user.email})</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;