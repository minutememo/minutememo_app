import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useUser } from '../UserContext';  // Import the user context hook

const SuperAdminDashboard = () => {
  const [companies, setCompanies] = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [companySearch, setCompanySearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState({}); // New state for tracking selected statuses
  const navigate = useNavigate();
  const { user } = useUser() || {};
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  const subscriptionOptions = ['active', 'inactive', 'pending', 'canceled'];

  useEffect(() => {
    if (!user || user.internal_user_role !== 'super_admin') {
      console.log("User not authorized, redirecting to login...");
      navigate('/superadmin/login');
      return;
    }

    const fetchCompanies = async () => {
      try {
        console.log("Fetching companies...");
        const response = await axios.get(`${backendUrl}/api/companies`, { withCredentials: true });
        setCompanies(response.data.companies);
        setFilteredCompanies(response.data.companies);
        console.log("Companies fetched:", response.data.companies);
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
      setFilteredUsers(response.data.users);
      console.log(`Users for company ${companyId}:`, response.data.users);
    } catch (err) {
      console.error('Error fetching users for company:', err);
    }
  };

  const handleBackClick = () => {
    setSelectedCompany(null);
    setUsers([]);
  };

  const handleCompanySearch = (e) => {
    const searchValue = e.target.value.toLowerCase();
    setCompanySearch(searchValue);
    setFilteredCompanies(companies.filter(company => company.name.toLowerCase().includes(searchValue)));
  };

  const handleUserSearch = (e) => {
    const searchValue = e.target.value.toLowerCase();
    setUserSearch(searchValue);
    setFilteredUsers(users.filter(user => 
      user.first_name.toLowerCase().includes(searchValue) ||
      user.last_name.toLowerCase().includes(searchValue) ||
      user.email.toLowerCase().includes(searchValue)
    ));
  };

  const handleSubscriptionChange = (companyId, newStatus) => {
    console.log(`Changing subscription status for company ${companyId} to ${newStatus}`);
    setSelectedStatuses({
      ...selectedStatuses,
      [companyId]: newStatus,
    });
  };

  const updateSubscriptionStatus = async (companyId, subscriptionId) => {
    const newStatus = selectedStatuses[companyId]; // Get the new status from selectedStatuses

    // Ensure both the new status and subscriptionId exist
    if (!newStatus || !subscriptionId) {
      alert("Invalid subscription or status");
      console.log("Subscription ID or status is missing:", subscriptionId, newStatus);
      return;
    }

    try {
      // Send the PATCH request to update the subscription status
      console.log(`Sending PATCH request to update subscription ${subscriptionId} with status ${newStatus}`);
      const response = await axios.patch(`${backendUrl}/api/subscriptions/${subscriptionId}`, {
        status: newStatus
      }, { withCredentials: true });

      // Check if the request was successful
      if (response.status === 200) {
        console.log(`Subscription ${subscriptionId} updated successfully to ${newStatus}`);
        // Update the companies state to reflect the updated status
        setCompanies(companies.map(c => 
          c.id === companyId ? { ...c, subscription: { ...c.subscription, status: newStatus } } : c
        ));
        alert("Subscription status updated successfully!");
      } else {
        alert("Failed to update subscription status.");
        console.log(`Error updating subscription ${subscriptionId}:`, response.status);
      }
    } catch (err) {
      console.error("Error updating subscription status:", err);
      alert("Failed to update subscription status.");
    }
  };

  return (
    <div className="dashboard">
      <h2>Super Admin Dashboard</h2>

      {!selectedCompany && (
        <>
          <input
            type="text"
            placeholder="Search for companies..."
            value={companySearch}
            onChange={handleCompanySearch}
            className="form-control"
          />
          <table>
            <thead>
              <tr>
                <th>Company Name</th>
                <th>City</th>
                <th>Country</th>
                <th>Subscription Status</th>
                <th>Actions</th>  {/* For the update button */}
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.map(company => {
                const subscription = company.subscription;
                console.log("Processing company:", company.name, "Subscription:", subscription);

                return (
                  <tr key={company.id}>
                    <td onClick={() => handleCompanyClick(company.id)} style={{ cursor: 'pointer' }}>{company.name}</td>
                    <td>{company.city}</td>
                    <td>{company.country}</td>
                    <td>
                      {subscription ? (
                        <select
                          value={selectedStatuses[company.id] || subscription.status} // Use selected status or fallback to current status
                          onChange={(e) => handleSubscriptionChange(company.id, e.target.value)}
                        >
                          {subscriptionOptions.map(option => (
                            <option key={option} value={option}>
                              {option.charAt(0).toUpperCase() + option.slice(1)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        'No Subscription'
                      )}
                    </td>
                    <td>
                    {subscription ? (
                    <>
                        {/* Log Subscription ID */}
                        {subscription.id ? (
                        <button 
                            onClick={() => updateSubscriptionStatus(company.id, subscription.id)} 
                            className="btn btn-primary"
                        >
                            Update
                        </button>
                        ) : (
                        <span>Subscription ID missing</span> // Log missing Subscription ID
                        )}
                    </>
                    ) : (
                    'No Actions'
                    )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {selectedCompany && (
        <>
          <button onClick={handleBackClick} className="btn btn-secondary">
            ← Back to Companies
          </button>

          <h3>Subscriptions</h3>
          <table>
            <thead>
              <tr>
                <th>Plan Name</th>
                <th>Status</th>
                <th>Price</th>
                <th>Billing Cycle</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Is Active</th>
              </tr>
            </thead>
            <tbody>
              {companies
                .find(company => company.id === selectedCompany)
                ?.subscription && (
                  <tr>
                    <td>{companies.find(company => company.id === selectedCompany).subscription.plan_name}</td>
                    <td>{companies.find(company => company.id === selectedCompany).subscription.status}</td>
                    <td>${companies.find(company => company.id === selectedCompany).subscription.price}</td>
                    <td>{companies.find(company => company.id === selectedCompany).subscription.billing_cycle}</td>
                    <td>{companies.find(company => company.id === selectedCompany).subscription.start_date}</td>
                    <td>{companies.find(company => company.id === selectedCompany).subscription.end_date}</td>
                    <td>{companies.find(company => company.id === selectedCompany).subscription.is_active ? 'Active' : 'Inactive'}</td>
                  </tr>
              )}
            </tbody>
          </table>

          <input
            type="text"
            placeholder="Search for users..."
            value={userSearch}
            onChange={handleUserSearch}
            className="form-control"
          />
          <table>
            <thead>
              <tr>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Email</th>
                <th>User Type</th>
                <th>Internal Role</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.id}>
                  <td>{user.first_name}</td>
                  <td>{user.last_name}</td>
                  <td>{user.email}</td>
                  <td>{user.user_type}</td>
                  <td>{user.internal_user_role || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default SuperAdminDashboard;