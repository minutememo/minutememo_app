import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const MeetingSessionPage = () => {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [actionPoints, setActionPoints] = useState([]); // For storing action points
  const [isExtracting, setIsExtracting] = useState(false); // For tracking extraction state
  const audioRef = useRef(null);

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await axios.get(`${backendUrl}/api/sessions/${sessionId}`);
        if (response.status === 200) {
          const sessionData = response.data.session;
          setSession(sessionData);
          setTranscription(sessionData.transcription || '');
        } else {
          setError('Failed to fetch session.');
        }
      } catch (err) {
        setError('Error fetching session.');
      }
    };
    fetchSession();
  }, [sessionId, backendUrl]);

  // Fetch action points
  const fetchActionPoints = async () => {
    try {
      const response = await axios.get(`${backendUrl}/api/sessions/${sessionId}/action_points`);
      if (response.status === 200) {
        setActionPoints(response.data.action_items);
      } else {
        setError('Failed to fetch action points.');
      }
    } catch (err) {
      setError('Error fetching action points.');
    }
  };

  // Fetch action points on component mount
  useEffect(() => {
    fetchActionPoints();
  }, [sessionId]);

  const handleTranscription = async () => {
    setIsTranscribing(true);
    try {
      const response = await axios.post(`${backendUrl}/api/transcribe/${sessionId}`);
      if (response.status === 200) {
        setTranscription(response.data.transcription);
      } else {
        setError('Failed to transcribe the audio.');
      }
    } catch (err) {
      setError('Error transcribing the audio.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleExtractActionPoints = async () => {
    setIsExtracting(true);
    try {
      const response = await axios.post(`${backendUrl}/api/extract_action_points/${sessionId}`);
      if (response.status === 200) {
        setActionPoints(response.data.action_items);
      } else {
        setError('Failed to extract action points.');
      }
    } catch (err) {
      setError('Error extracting action points.');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="session-page">
      {error && <p className="error-message">{error}</p>}
      {session ? (
        <div>
          <h2>{session.name}</h2>
          <p>Date: {new Date(session.session_datetime).toLocaleString()}</p>

          {transcription && (
            <div className="transcription" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px' }}>
              <h3>Transcription:</h3>
              <p>{transcription}</p>
            </div>
          )}

          {session.audio_url ? (
            <div>
              <audio ref={audioRef} src={session.audio_url} controls />
              <a href={session.audio_url} download>
                Download Audio
              </a>

              <button onClick={handleTranscription} disabled={isTranscribing}>
                {isTranscribing ? 'Transcribing...' : 'Transcribe Audio'}
              </button>

              <button onClick={handleExtractActionPoints} disabled={isExtracting}>
                {isExtracting ? 'Extracting Action Points...' : 'Extract Action Points'}
              </button>

              {actionPoints && actionPoints.length > 0 ? (
                <div className="action-points">
                  <h3>Action Points:</h3>
                  <ul>
                    {actionPoints.map((item, index) => (
                      <li key={index}>
                        <strong>{item.description}</strong> - Assigned to: {item.assigned_to}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p>No action points available.</p>
              )}
            </div>
          ) : (
            <p>No audio recording available.</p>
          )}
        </div>
      ) : (
        !error && <p>Loading session...</p>
      )}
    </div>
  );
};

export default MeetingSessionPage;