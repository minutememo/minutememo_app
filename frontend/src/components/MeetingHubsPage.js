// src/components/MeetingHubsPage.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles.css'; // Assuming styles.css is in the src folder

const MeetingHubsPage = () => {
  const [meetingHubs, setMeetingHubs] = useState([]);
  const [error, setError] = useState('');

  // Environment variable for backend URL
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    // Fetch the user's meeting hubs when the component mounts
    const fetchMeetingHubs = async () => {
      try {
        const response = await axios.get(`${backendUrl}/api/meetinghubs`);
        if (response.status === 200) {
          setMeetingHubs(response.data.meeting_hubs);
        } else {
          setError('Failed to fetch meeting hubs');
        }
      } catch (err) {
        setError('Error fetching meeting hubs');
        console.error(err);
      }
    };

    fetchMeetingHubs();
  }, [backendUrl]);

  return (
    <div className="meeting-hubs">
      <h2>Meeting Hubs</h2>
      {error && <p className="error">{error}</p>}
      <ul>
        {meetingHubs.map(hub => (
          <li key={hub.id}>
            <h3>{hub.name}</h3>
            <p>{hub.description}</p>
            <p><strong>Users:</strong> {hub.users.join(', ')}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MeetingHubsPage;