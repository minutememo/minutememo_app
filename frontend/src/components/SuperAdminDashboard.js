import React, { useEffect, useState } from 'react';
import axios from 'axios';

const SuperAdminDashboard = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [users, setUsers] = useState([]);
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await axios.get(`${backendUrl}/api/companies`);
        setCompanies(response.data.companies);
      } catch (err) {
        console.error('Error fetching companies', err);
      }
    };

    fetchCompanies();
  }, []);

  const handleCompanyClick = async (companyId) => {
    try {
      const response = await axios.get(`${backendUrl}/api/companies/${companyId}/users`);
      setSelectedCompany(companyId);
      setUsers(response.data.users);
    } catch (err) {
      console.error('Error fetching users for company', err);
    }
  };

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