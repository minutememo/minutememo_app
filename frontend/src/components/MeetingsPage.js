import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useUser } from '../UserContext';

const MeetingsPage = ({ selectedHub, onMeetingSelect }) => {
  const { meetingId } = useParams();
  const [meetings, setMeetings] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useUser();
  const navigate = useNavigate();
  
  // Environment variable for backend URL
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    console.log('MeetingsPage component loaded. SelectedHub:', selectedHub, 'User:', user);
  }, [selectedHub, user]);

  // Fetch meetings tied to the user and hub when selectedHub is set
  useEffect(() => {
    if (!selectedHub) {
      console.log('Waiting for selectedHub to be set...');
      return;
    }

    if (user) {
      console.log('Fetching meetings for selectedHub:', selectedHub);

      const fetchMeetings = async () => {
        try {
          setLoading(true);
          const response = await axios.get(`${backendUrl}/api/meetings?hub_id=${selectedHub}`);
          console.log('Meetings fetch response:', response);

          if (response.status === 200 && response.data.meetings) {
            setMeetings(response.data.meetings);
            console.log('Meetings fetched:', response.data.meetings);
          } else {
            setError('Failed to fetch meetings.');
          }
        } catch (err) {
          console.error('Error fetching meetings:', err);
          setError('Error fetching meetings.');
        } finally {
          setLoading(false);
        }
      };

      fetchMeetings();
    } else {
      console.log('Skipping meetings fetch: user is missing.');
    }
  }, [selectedHub, user, backendUrl]);

  // Fetch sessions for a specific meeting
  useEffect(() => {
    if (!selectedHub || !meetingId || !user) {
      console.log('Skipping sessions fetch: selectedHub, meetingId, or user is missing.');
      return;
    }

    console.log('Fetching sessions for meetingId:', meetingId);

    const fetchSessions = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${backendUrl}/api/meetings?meeting_id=${meetingId}`);
        console.log('Sessions fetch response:', response);

        if (response.status === 200 && response.data.sessions.length > 0) {
          setSessions(response.data.sessions);
        } else {
          setSessions([]);  // Ensure sessions state is reset if no sessions found
        }
      } catch (err) {
        console.error('Error fetching sessions:', err); // Only log the error
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [selectedHub, meetingId, user, backendUrl]);

  // Handle meeting selection and notify parent component
  const handleMeetingSelect = (meetingId) => {
    if (onMeetingSelect) {
      onMeetingSelect(meetingId); // Notify parent component of the selected meeting
    }
  };

  // Navigate to create a new session for the selected meeting
  const handleStartNewSession = async () => {
    try {
      const response = await axios.post(`${backendUrl}/api/sessions`, { meeting_id: meetingId });
  
      if (response.status === 201) {
        const newSessionId = response.data.session_id;
        console.log('New session created:', newSessionId);
  
        // Navigate to the new session page
        navigate(`/sessions/${newSessionId}`);
      } else {
        setError('Failed to create a new session.');
      }
    } catch (err) {
      console.error('Error creating a new session:', err);
      setError('Error creating a new session.');
    }
  };

  if (loading) {
    console.log('Loading data...');
    return <p>Loading...</p>;
  }

  return (
    <div className="meeting-page">
      {error && <p className="error-message">{error}</p>}

      {!meetingId && meetings.length > 0 && (
        <div className="box-shadow-container">
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
                <tr key={meeting.id} onClick={() => handleMeetingSelect(meeting.id)}> {/* Call handleMeetingSelect */}
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
      )}

      {meetingId && (
        <div className="box-shadow-container">
          <h3>Sessions</h3>

          {sessions.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Session Name</th>
                  <th>Date and Time</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(session => (
                  <tr key={session.id}>
                    <td>
                      <Link to={`/sessions/${session.id}`}>{session.name}</Link>
                    </td>
                    <td>{new Date(session.session_datetime).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Start your first session here!</p> // Updated message for no sessions
          )}

          <button onClick={handleStartNewSession}>Start New Session</button>
        </div>
      )}
    </div>
  );
};

export default MeetingsPage;