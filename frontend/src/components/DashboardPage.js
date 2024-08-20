// src/components/DashboardPage.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles.css'; // Assuming styles.css is in the src folder

const DashboardPage = ({ selectedHub }) => {
  const [recordings, setRecordings] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedHub) {
      // Fetch the user's recordings for the selected meeting hub when the component mounts
      const fetchRecordings = async () => {
        try {
          const response = await axios.get(`http://localhost:5000/api/recordings?hub_id=${selectedHub}`);
          if (response.status === 200) {
            setRecordings(response.data.recordings);
          } else {
            setError('Failed to fetch recordings');
          }
        } catch (err) {
          setError('Error fetching recordings');
          console.error(err);
        }
      };

      fetchRecordings();
    }
  }, [selectedHub]);

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>File Name</th>
            <th>Date Recorded</th>
            <th>Status</th>
            <th>Play</th>
          </tr>
        </thead>
        <tbody>
          {recordings.map(rec => (
            <tr key={rec.id}>
              <td>{rec.file_name}</td>
              <td>{rec.timestamp}</td>
              <td>{rec.concatenation_status}</td>
              <td>
                <audio controls>
                  <source src={rec.file_url} type="audio/mp3" />
                  Your browser does not support the audio element.
                </audio>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DashboardPage;