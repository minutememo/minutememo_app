import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useUser } from '../UserContext';

const VisibilityOptions = {
  ALL_HUB_MEMBERS: 'all_hub_members',
  PARTICIPANTS: 'participants',
  PRIVATE: 'private_to_organiser',
};

const MeetingsPage = () => {
  const { meetingId } = useParams();
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [visibility, setVisibility] = useState(VisibilityOptions.PARTICIPANTS); // default value
  const { user } = useUser();
  const navigate = useNavigate();

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  // Fetch sessions and visibility for the specific meeting
  useEffect(() => {
    if (!meetingId || !user) {
      console.log('Skipping fetch: meetingId or user is missing.');
      return;
    }

    console.log('Fetching sessions and visibility for meetingId:', meetingId);

    const fetchMeetingData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${backendUrl}/api/meetings?meeting_id=${meetingId}`);
        console.log('Meeting data fetch response:', response);

        if (response.status === 200) {
          const { sessions, visibility: fetchedVisibility } = response.data;
          setSessions(sessions || []);
          setVisibility(fetchedVisibility || VisibilityOptions.PARTICIPANTS); // Default to "Participants" if not provided
        } else {
          setSessions([]);
          setError('No sessions found for this meeting.');
        }
      } catch (err) {
        console.error('Error fetching meeting data:', err);
        setError('Error fetching meeting data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchMeetingData();
  }, [meetingId, user, backendUrl]);

  // Function to handle starting a new session for the meeting
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

  // Function to handle visibility change
  const handleVisibilityChange = async (event) => {
    const newVisibility = event.target.value;
    setVisibility(newVisibility);

    try {
      const response = await axios.put(`${backendUrl}/api/meetings/${meetingId}/visibility`, {
        visibility: newVisibility,
      });

      if (response.status === 200) {
        console.log('Visibility updated successfully.');
      } else {
        setError('Failed to update visibility.');
      }
    } catch (err) {
      console.error('Error updating visibility:', err);
      setError('Error updating visibility.');
    }
  };

  if (loading) {
    console.log('Loading data...');
    return <p>Loading...</p>;
  }

  return (
    <div className="meeting-page">
      {error && <p className="error-message">{error}</p>}

      <div className="box-shadow-container">
        <h3>Meeting Visibility Settings</h3>
        <select value={visibility} onChange={handleVisibilityChange}>
          <option value={VisibilityOptions.ALL_HUB_MEMBERS}>All Hub Members</option>
          <option value={VisibilityOptions.PARTICIPANTS}>Participants Only</option>
          <option value={VisibilityOptions.PRIVATE}>Private to Organizer</option>
        </select>
      </div>

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