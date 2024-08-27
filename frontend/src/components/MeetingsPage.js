import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom'; // Import Link for navigation
import axios from 'axios';

const MeetingPage = () => {
  const { meetingId } = useParams(); // Get meeting ID from the URL
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');

  // Environment variable for backend URL
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    // Fetch sessions for the meeting
    const fetchSessions = async () => {
      try {
        const response = await axios.get(`${backendUrl}/api/meetings?meeting_id=${meetingId}`);
        if (response.status === 200) {
          if (response.data.sessions.length > 0) {
            setSessions(response.data.sessions);
          } else {
            setError('No sessions found for this meeting.');
          }
        } else {
          setError('Failed to fetch sessions.');
        }
      } catch (err) {
        setError('Error fetching sessions.');
        console.error(err);
      }
    };

    fetchSessions();
  }, [meetingId, backendUrl]);

  return (
    <div className="meeting-page">
      {error && <p className="error-message">{error}</p>}
      {sessions.length > 0 ? (
        <div>
          <h3>Sessions</h3>
          <ul>
            {sessions.map(session => (
              <li key={session.id}>
                <Link to={`/sessions/${session.id}`}>
                  <strong>{session.name}</strong> - {new Date(session.session_datetime).toLocaleString()}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        !error && <p>Loading sessions...</p>
      )}
    </div>
  );
};

export default MeetingPage;