import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const MeetingSessionPage = () => {
  const { sessionId } = useParams(); // Get session ID from the URL
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [transcription, setTranscription] = useState('');  // State for transcription result
  const [isTranscribing, setIsTranscribing] = useState(false); // State for transcribing status
  const audioRef = useRef(null);

  const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    // Fetch session details and transcription
    const fetchSession = async () => {
      try {
        console.log(`Fetching session details for session ID: ${sessionId}`);
        const response = await axios.get(`${baseURL}/api/sessions/${sessionId}`);
        if (response.status === 200) {
          const sessionData = response.data.session;
          setSession(sessionData);
          
          // Log transcription data
          console.log('Transcription data:', sessionData.transcription);
          
          setTranscription(sessionData.transcription || ''); // Set transcription if available
          console.log('Session data received:', sessionData);
          if (sessionData.transcription) {
            console.log('Transcription loaded from session:', sessionData.transcription);
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

  const handleTranscription = async () => {
    setIsTranscribing(true); // Start transcribing
    console.log(`Starting transcription for session ID: ${sessionId}`);
    
    try {
      console.log(`Sending request to transcribe audio for session ID: ${sessionId}`);
      const response = await axios.post(`${baseURL}/api/transcribe/${sessionId}`);
      
      if (response.status === 200) {
        console.log(`Transcription successful for session ID: ${sessionId}`);
        setTranscription(response.data.transcription);  // Store the transcription result
        console.log('Transcription:', response.data.transcription);
      } else {
        console.error(`Transcription failed with status ${response.status} for session ID: ${sessionId}`);
        setError('Failed to transcribe the audio.');
      }
    } catch (err) {
      console.error(`Error occurred during transcription for session ID: ${sessionId}`, err);
      setError('Error transcribing the audio.');
    } finally {
      console.log(`Transcription process finished for session ID: ${sessionId}`);
      setIsTranscribing(false); // Stop loading
    }
  };

  return (
    <div className="session-page">
      {error && <p className="error-message">{error}</p>}
      {session ? (
        <div>
          <h2>{session.name}</h2>
          <p>Date: {new Date(session.session_datetime).toLocaleString()}</p>

          {/* Display Transcription Result */}
          {transcription && (
            <div className="transcription">
              <h3>Transcription:</h3>
              <p>{transcription}</p>
            </div>
          )}

          {session.audio_url ? (
            <div>
              <audio ref={audioRef} src={`${baseURL}/${session.audio_url}`} controls />
              <div className="audio-controls">
                <button onClick={() => audioRef.current.play()}>Play</button>
                <button onClick={() => audioRef.current.pause()}>Pause</button>
                <button onClick={() => (audioRef.current.currentTime -= 10)}>-10s</button>
                <button onClick={() => (audioRef.current.currentTime += 10)}>+10s</button>
              </div>

              {/* Transcription Button */}
              <button onClick={handleTranscription} disabled={isTranscribing}>
                {isTranscribing ? 'Transcribing...' : 'Transcribe Audio'}
              </button>
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