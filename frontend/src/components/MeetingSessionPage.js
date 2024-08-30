import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const MeetingSessionPage = () => {
  const { sessionId } = useParams(); // Get session ID from the URL
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const audioRef = useRef(null);

  const baseURL = process.env.REACT_APP_API_URL || '';

  useEffect(() => {
    // Fetch session details
    const fetchSession = async () => {
      try {
        console.log(`Fetching session details for session ID: ${sessionId}`);
        const response = await axios.get(`${baseURL}/api/sessions/${sessionId}`);
        if (response.status === 200) {
          setSession(response.data.session);
          console.log('Session data received:', response.data.session);

          if (response.data.session.audio_url) {
            console.log(`Audio file URL received: ${baseURL}/${response.data.session.audio_url}`);
          } else {
            console.log('No audio file URL found in the session data.');
          }
        } else {
          setError('Failed to fetch session.');
          console.error('Failed to fetch session. Status:', response.status);
        }
      } catch (err) {
        setError('Error fetching session.');
        console.error('Error fetching session:', err);
      }
    };

    fetchSession();
  }, [sessionId, baseURL]);

  const playAudio = () => {
    if (audioRef.current) {
      console.log('Playing audio:', audioRef.current.src);
      audioRef.current.play();
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      console.log('Pausing audio:', audioRef.current.src);
      audioRef.current.pause();
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      console.log('Skipping forward 10 seconds in audio:', audioRef.current.src);
      audioRef.current.currentTime += 10;
    }
  };

  const skipBackward = () => {
    if (audioRef.current) {
      console.log('Skipping backward 10 seconds in audio:', audioRef.current.src);
      audioRef.current.currentTime -= 10;
    }
  };

  return (
    <div className="session-page">
      {error && <p className="error-message">{error}</p>}
      {session ? (
        <div>
          <h2>{session.name}</h2>
          <p>Date: {new Date(session.session_datetime).toLocaleString()}</p>
          {session.audio_url ? (
            <div>
              <audio ref={audioRef} src={`${baseURL}/${session.audio_url}`} controls />
              <div className="audio-controls">
                <button onClick={playAudio}>Play</button>
                <button onClick={pauseAudio}>Pause</button>
                <button onClick={skipBackward}>-10s</button>
                <button onClick={skipForward}>+10s</button>
              </div>
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