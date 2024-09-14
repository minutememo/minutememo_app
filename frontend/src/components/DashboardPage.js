import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import '../styles.css';
import { useUser } from '../UserContext'; // Import useUser from UserContext

const DashboardPage = ({ selectedHub }) => {
  const { user } = useUser(); // Get the user context
  const [meetings, setMeetings] = useState([]);
  const [meetingSessions, setMeetingSessions] = useState([]);
  const [error, setError] = useState('');
  const [subscriptionActive, setSubscriptionActive] = useState(false); // Track subscription status
  const [subscriptionEmpty, setSubscriptionEmpty] = useState(false); // Track empty subscription
  const [isLoading, setIsLoading] = useState(true); // Track loading state
  const navigate = useNavigate();

  // Environment variable for backend URL
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  // Check subscription status if the user is logged in
  useEffect(() => {
    if (user) {
      const checkSubscriptionStatus = async () => {
        try {
          setIsLoading(true); // Start loading
          const response = await axios.get(`${backendUrl}/api/subscription-status`, { withCredentials: true });
          if (response.status === 200) {
            if (response.data.is_active) {
              setSubscriptionActive(true); // Subscription is active
            } else if (response.data.is_empty) {
              setSubscriptionEmpty(true); // Subscription is empty
            } else {
              setSubscriptionActive(false); // Subscription is inactive
              navigate('/subscribe'); // Redirect to subscription page if inactive
            }
          } else {
            setError('Failed to fetch subscription status');
          }
        } catch (err) {
          setError('Error checking subscription status');
          console.error(err);
        } finally {
          setIsLoading(false); // Stop loading after the check is complete
        }
      };

      checkSubscriptionStatus();
    } else {
      // If no user is logged in, stop loading and don't perform any subscription checks
      setIsLoading(false);
    }
  }, [user, backendUrl, navigate]);

  // Fetch meetings and meeting sessions if the subscription is active and a hub is selected
  useEffect(() => {
    if (selectedHub && subscriptionActive) {
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

  // Return early if no user is logged in
  if (!user) {
    return <p>Please log in to access your dashboard.</p>;
  }

  // Return a loading message while checking subscription status
  if (isLoading) {
    return <p>Checking subscription status...</p>;
  }

  // If subscription is empty, show the message but not the subscription page
  if (subscriptionEmpty) {
    return (
      <div className="dashboard">
        <h3>No Subscription Found</h3>
        <p>Please <Link to="/subscribe">subscribe</Link> to access your dashboard.</p>
      </div>
    );
  }

  // If the subscription is inactive, show a message indicating that it's inactive
  if (!subscriptionActive) {
    return <p>Your subscription is inactive. Please <Link to="/subscribe">subscribe</Link> to continue.</p>;
  }

  // Normal dashboard content when the user is logged in and subscription is active
  return (
    <div className="dashboard">
      <div className="box-shadow-container">
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
                  <Link to={`/meetings/${meeting.id}`}>{meeting.name}</Link>
                </td>
                <td>{meeting.description}</td>
                <td>{meeting.is_recurring ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
  
      <div className="box-shadow-container">
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
    </div>
  );
};

export default DashboardPage;