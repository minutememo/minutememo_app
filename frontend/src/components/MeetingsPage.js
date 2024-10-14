import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useUser } from '../UserContext';

const MeetingsPage = () => {
  const { meetingId } = useParams();
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useUser();
  const navigate = useNavigate();
  
  // Environment variable for backend URL
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  // Fetch sessions for the specific meeting
  useEffect(() => {
    if (!meetingId || !user) {
      console.log('Skipping sessions fetch: meetingId or user is missing.');
      return;
    }

    console.log('Fetching sessions for meetingId:', meetingId);

    const fetchSessions = async () => {
      try {
        setLoading(true);  // Set loading to true while fetching data
        const response = await axios.get(`${backendUrl}/api/meetings?meeting_id=${meetingId}`);
        console.log('Sessions fetch response:', response);
    
        if (response.status === 200 && response.data.sessions) {
          setSessions(response.data.sessions);
        } else {
          setSessions([]);  // Ensure sessions state is reset if no sessions found
          setError('No sessions found for this meeting.');
        }
      } catch (err) {
        console.error('Error fetching sessions:', err); 
        setError('Error fetching sessions. Please try again later.');
      } finally {
        setLoading(false);  // Set loading to false after fetching
      }
    };

    fetchSessions();
  }, [meetingId, user, backendUrl]);

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

      {sessions.length > 0 ? (
        <div className="box-shadow-container">
          <h3>Sessions</h3>
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
        </div>
      ) : (
        <p>No sessions found for this meeting.</p>
      )}

      <button onClick={handleStartNewSession}>Start New Session</button>
    </div>
  );
};

export default MeetingsPage;