import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import '../styles.css';
import { useUser } from '../UserContext';

const DashboardPage = ({ selectedHub }) => {
  const { user } = useUser(); // Get the user context
  const [meetings, setMeetings] = useState([]);
  const [meetingSessions, setMeetingSessions] = useState([]);
  const [error, setError] = useState('');
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [subscriptionEmpty, setSubscriptionEmpty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newMeetingName, setNewMeetingName] = useState(''); // For the new meeting input
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false); // Track the creation process
  const navigate = useNavigate();

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    if (user) {
      const checkSubscriptionStatus = async () => {
        try {
          setIsLoading(true);
          const response = await axios.get(`${backendUrl}/api/subscription-status`, { withCredentials: true });
          if (response.status === 200) {
            if (response.data.is_active) {
              setSubscriptionActive(true);
            } else if (response.data.is_empty) {
              setSubscriptionEmpty(true);
            } else {
              setSubscriptionActive(false);
              navigate('/subscribe');
            }
          } else {
            setError('Failed to fetch subscription status');
          }
        } catch (err) {
          setError('Error checking subscription status');
        } finally {
          setIsLoading(false);
        }
      };
      checkSubscriptionStatus();
    } else {
      setIsLoading(false);
    }
  }, [user, backendUrl, navigate]);

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
        }
      };

      fetchMeetings();
      fetchMeetingSessions();
    }
  }, [selectedHub, backendUrl, subscriptionActive]);

  const handleCreateMeeting = async () => {
    if (!newMeetingName || !selectedHub) {
      setError('Please provide a meeting name and select a hub.');
      return;
    }

    setIsCreatingMeeting(true);

    try {
      const response = await axios.post(`${backendUrl}/api/meetings`, {
        name: newMeetingName,
        hub_id: selectedHub,
      });
      if (response.status === 201) {
        setMeetings((prevMeetings) => [...prevMeetings, { id: response.data.meeting_session_id, name: newMeetingName }]);
        setNewMeetingName(''); // Clear the input after successful creation
      } else {
        setError('Failed to create a new meeting');
      }
    } catch (err) {
      setError('Error creating a new meeting');
    } finally {
      setIsCreatingMeeting(false);
    }
  };

  if (!user) {
    return <p>Please log in to access your dashboard.</p>;
  }

  if (isLoading) {
    return <p>Checking subscription status...</p>;
  }

  if (subscriptionEmpty) {
    return (
      <div className="dashboard">
        <h3>No Subscription Found</h3>
        <p>
          Please <Link to="/subscribe">subscribe</Link> to access your dashboard.
        </p>
      </div>
    );
  }

  if (!subscriptionActive) {
    return <p>Your subscription is inactive. Please <Link to="/subscribe">subscribe</Link> to continue.</p>;
  }

  return (
    <div className="dashboard">
      <div className="box-shadow-container">
        <h3>Create a New Meeting</h3>
        <input
          type="text"
          placeholder="Enter meeting name"
          value={newMeetingName}
          onChange={(e) => setNewMeetingName(e.target.value)}
        />
        <button onClick={handleCreateMeeting} disabled={isCreatingMeeting}>
          {isCreatingMeeting ? 'Creating...' : 'Create Meeting'}
        </button>
        {error && <p className="error-message">{error}</p>}
      </div>

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
            {meetings.map((meeting) => (
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
            {meetingSessions.map((session) => (
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