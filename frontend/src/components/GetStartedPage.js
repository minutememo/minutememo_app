// GetStartedPage.js

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Spinner, Alert } from 'react-bootstrap';
import { useUser } from '../UserContext'; // Adjust the path as necessary

function GetStartedPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { logoutUser } = useUser(); // Destructure logoutUser from context
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  // Helper function to sanitize subdomain
  const sanitizeSubdomain = (name) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^a-z0-9-]/g, ''); // Remove invalid characters
  };

  useEffect(() => {
    const fetchCompanies = async () => {
      console.log("[GetStartedPage] Fetching companies...");
      try {
        setLoading(true);
        const response = await axios.get(`${backendUrl}/api/user/company`, {
          withCredentials: true,
        });
        if (response.status === 200) {
          setCompanies(response.data.companies);
          console.log("[GetStartedPage] Companies fetched:", response.data.companies);
        } else {
          setError('Failed to fetch companies.');
          console.warn(`[GetStartedPage] Failed to fetch companies. Status: ${response.status}`);
        }
      } catch (err) {
        console.error('Error fetching companies:', err);
        setError('An error occurred while fetching companies.');
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, [backendUrl]);

  // Unified Logout function using logoutUser from context
  const handleLogout = async () => {
    console.log("[GetStartedPage] Initiating logout...");
    try {
      await logoutUser();
      console.log("Logout successful");
    } catch (err) {
      console.error('Error during logout:', err);
      setError('An error occurred while logging out.');
    }
  };

  // Function to handle company selection and navigation
  const handleCompanySelect = (companyName) => {
    console.log(`[GetStartedPage] Selected company: ${companyName}`);
    const sanitizedSubdomain = sanitizeSubdomain(companyName);
    console.log(`[GetStartedPage] Sanitized subdomain: ${sanitizedSubdomain}`);
    if (!sanitizedSubdomain) {
      setError('Invalid company name for navigation.');
      console.error("[GetStartedPage] Invalid company name for navigation.");
      return;
    }
    // Construct the URL. Ensure you use HTTPS in production.
    const companyUrl = `https://${sanitizedSubdomain}.minutememo.io`;
    console.log(`[GetStartedPage] Navigating to: ${companyUrl}`);
    window.location.href = companyUrl;
  };

  return (
    <div className="start-container">
      <button className="button-secondary logout-button" onClick={handleLogout}>
        Logout
      </button>

      <div className="start-card">
        <h1>Get started on MinuteMemo</h1>
        <p>
          It’s a new way to communicate with everyone that you work with. It’s faster, better organized,
          and more secure than email – and it’s free to try.
        </p>
        <button className="button-primary">Create a workspace</button>

        <div className="email-consent">
          <p>Can we send you emails with MinuteMemo tips, news, and offers?</p>
          <label>
            <input type="radio" name="email_consent" value="yes" /> Of course!
          </label>
          <label>
            <input type="radio" name="email_consent" value="no" /> No thanks
          </label>
        </div>

        <div className="try-another-email">
          <p>Is your team already on MinuteMemo?</p>
          <button>Try a different email</button>
        </div>

        <div className="company-list-section">
          <h2>Your Companies</h2>
          {loading ? (
            <div className="spinner-container">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          ) : error ? (
            <Alert variant="danger">{error}</Alert>
          ) : companies.length > 0 ? (
            companies.map((company) => (
              <div
                key={company.id}
                className="company-card"
                onClick={() => handleCompanySelect(company.name)}
                style={{ cursor: 'pointer' }}
              >
                <div className="company-logo">
                  <img src="https://via.placeholder.com/40" alt={`${company.name} Logo`} />
                </div>
                <div className="company-info">
                  <h3 className="company-name">{company.name}</h3>
                  <p className="company-members">1 member</p> {/* Update if you have member count */}
                </div>
                <div className="company-arrow">
                  <span>&#10132;</span>
                </div>
              </div>
            ))
          ) : (
            <Alert variant="info">You are not associated with any company.</Alert>
          )}
        </div>

        <div className="illustration">
          <img src="https://via.placeholder.com/100" alt="Illustration 1" />
          <img src="https://via.placeholder.com/100" alt="Illustration 2" />
          <img src="https://via.placeholder.com/100" alt="Illustration 3" />
        </div>
      </div>
    </div>
  );
}

export default GetStartedPage;