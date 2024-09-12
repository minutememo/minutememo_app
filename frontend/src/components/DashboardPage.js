import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom'; // Import useNavigate for navigation
import '../styles.css'; // Assuming styles.css is in the src folder

const DashboardPage = ({ selectedHub }) => {
  const [meetings, setMeetings] = useState([]);
  const [meetingSessions, setMeetingSessions] = useState([]);
  const [error, setError] = useState('');
  const [subscriptionActive, setSubscriptionActive] = useState(false); // State to track subscription status
  const [subscriptionEmpty, setSubscriptionEmpty] = useState(false); // State to track empty subscription
  const navigate = useNavigate();

  // Environment variable for backend URL
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    // Check subscription status
    const checkSubscriptionStatus = async () => {
      try {
        const response = await axios.get(`${backendUrl}/api/subscription-status`, { withCredentials: true });
        if (response.status === 200) {
          if (response.data.is_active) {
            setSubscriptionActive(true); // Set subscription to active
          } else if (response.data.is_empty) {
            setSubscriptionEmpty(true); // Set subscription to empty
          } else {
            setSubscriptionActive(false); // Handle inactive subscription
            navigate('/subscribe'); // Redirect to subscription page if inactive
          }
        } else {
          setError('Failed to fetch subscription status');
        }
      } catch (err) {
        setError('Error checking subscription status');
        console.error(err);
      }
    };

    checkSubscriptionStatus();
  }, [backendUrl, navigate]);

  useEffect(() => {
    if (selectedHub && subscriptionActive) {
      // Fetch the meetings for the selected meeting hub when the component mounts
      const fetchMeetings = async () => {
        try {
          const response = await axios.get(`${backendUrl}/api/meetings?hub_id=${selectedHub}`);
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
          const response = await axios.get(`${backendUrl}/api/meetingsessions?hub_id=${selectedHub}`);
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
  }, [selectedHub, backendUrl, subscriptionActive]);

  if (subscriptionEmpty) {
    return (
      <div className="dashboard">
        <h3>No Subscription Found</h3>
        <p>Please <Link to="/subscribe">subscribe</Link> to access your dashboard.</p>
      </div>
    );
  }

  if (!subscriptionActive) {
    return <p>Checking subscription status...</p>; // Display message while checking subscription
  }

  return (
    <div className="dashboard">
      <h3>Meetings</h3>
      {error && <p className="error-message">{error}</p>}
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
              <td>
                <Link to={`/meetings/${meeting.id}`}> {/* Link to the MeetingPage */}
                  {meeting.name}
                </Link>
              </td>
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