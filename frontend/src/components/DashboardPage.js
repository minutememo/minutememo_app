import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles.css'; // Assuming styles.css is in the src folder

const DashboardPage = ({ selectedHub }) => {
  const [meetings, setMeetings] = useState([]);
  const [meetingSessions, setMeetingSessions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedHub) {
      // Fetch the meetings for the selected meeting hub when the component mounts
      const fetchMeetings = async () => {
        try {
          const response = await axios.get(`http://localhost:5000/api/meetings?hub_id=${selectedHub}`);
          if (response.status === 200) {
            setMeetings(response.data.meetings);
          } else {
            setError('Failed to fetch meetings');
          }
        } catch (err) {
          setError('Error fetching meetings');
          console.error(err);
        }
      };

      // Fetch the meeting sessions for the selected meeting hub when the component mounts
      const fetchMeetingSessions = async () => {
        try {
          const response = await axios.get(`http://localhost:5000/api/meetingsessions?hub_id=${selectedHub}`);
          if (response.status === 200) {
            setMeetingSessions(response.data.meeting_sessions);
          } else {
            setError('Failed to fetch meeting sessions');
          }
        } catch (err) {
          setError('Error fetching meeting sessions');
          console.error(err);
        }
      };

      fetchMeetings();
      fetchMeetingSessions();
    }
  }, [selectedHub]);

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>
      {error && <p className="error">{error}</p>}

      <h3>Meetings</h3>
      <table>
        <thead>
          <tr>
            <th>Meeting Name</th>
            <th>Description</th>
            <th>Is Recurring</th>
          </tr>
        </thead>
        <tbody>
          {meetings.map(meeting => (
            <tr key={meeting.id}>
              <td>{meeting.name}</td>
              <td>{meeting.description}</td>
              <td>{meeting.is_recurring ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Meeting Sessions</h3>
      <table>
        <thead>
          <tr>
            <th>Session Name</th>
            <th>Meeting Name</th>
            <th>Date and Time</th>
          </tr>
        </thead>
        <tbody>
          {meetingSessions.map(session => (
            <tr key={session.id}>
              <td>{session.name}</td>
              <td>{session.meeting_name}</td>
              <td>{session.session_datetime}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DashboardPage;