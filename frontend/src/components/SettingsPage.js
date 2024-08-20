// src/components/SettingsPage.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SettingsPage = () => {
  const [company, setCompany] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: '',
    phone_number: '',
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Fetch the existing company details when the component mounts
    const fetchCompany = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/company');
        if (response.status === 200 && response.data.company) {
          setCompany(response.data.company);
        }
      } catch (err) {
        console.error('Error fetching company details:', err);
      }
    };

    fetchCompany();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCompany({ ...company, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/api/company', company);
      if (response.status === 200) {
        setMessage('Company details updated successfully.');
      } else {
        setMessage('Failed to update company details.');
      }
    } catch (err) {
      console.error('Error updating company details:', err);
      setMessage('Error updating company details.');
    }
  };

  return (
    <div>
      <h2>Settings</h2>
      <h3>Company Details</h3>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Name:</label>
          <input
            type="text"
            name="name"
            value={company.name}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>Address:</label>
          <input
            type="text"
            name="address"
            value={company.address}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>City:</label>
          <input
            type="text"
            name="city"
            value={company.city}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>State:</label>
          <input
            type="text"
            name="state"
            value={company.state}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Zip Code:</label>
          <input
            type="text"
            name="zip_code"
            value={company.zip_code}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Country:</label>
          <input
            type="text"
            name="country"
            value={company.country}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Phone Number:</label>
          <input
            type="text"
            name="phone_number"
            value={company.phone_number}
            onChange={handleChange}
          />
        </div>
        <button type="submit">Save</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default SettingsPage;