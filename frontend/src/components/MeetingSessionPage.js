import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const MeetingSessionPage = () => {
  const { sessionId } = useParams(); 
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const audioRef = useRef(null);

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchSession = async () => {
      try {
        console.log(`Fetching session details for session ID: ${sessionId}`);
        const response = await axios.get(`${backendUrl}/api/sessions/${sessionId}`);
        if (response.status === 200) {
          const sessionData = response.data.session;
          setSession(sessionData);
          setTranscription(sessionData.transcription || '');
          console.log('Session data received:', sessionData);
        } else {
          setError('Failed to fetch session.');
        }
      } catch (err) {
        setError('Error fetching session.');
      }
    };
    fetchSession();
  }, [sessionId, backendUrl]);

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

  const getAudioUrl = (audioUrl) => {
    if (audioUrl.startsWith('/uploads')) {
      return `${backendUrl}${audioUrl}`;
    } else if (audioUrl.startsWith('gs://')) {
      // Replace 'gs://' with 'https://storage.googleapis.com/'
      return audioUrl.replace('gs://', 'https://storage.googleapis.com/');
    } else if (audioUrl.includes('gs://')) {
      // Extract the path after 'gs://' and construct the correct URL
      const gsIndex = audioUrl.indexOf('gs://');
      const path = audioUrl.substring(gsIndex + 5); // Remove 'gs://'
      return `https://storage.googleapis.com/${path}`;
    } else {
      return decodeURIComponent(audioUrl);
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
            <div className="transcription">
              <h3>Transcription:</h3>
              <p>{transcription}</p>
            </div>
          )}

          {session.audio_url ? (
            <div>
              {console.log(`Audio file URL: ${getAudioUrl(session.audio_url)}`)}

              <audio ref={audioRef} src={getAudioUrl(session.audio_url)} controls />
              
              <div className="audio-controls">
                <button onClick={() => audioRef.current.play()}>Play</button>
                <button onClick={() => audioRef.current.pause()}>Pause</button>
                <button onClick={() => (audioRef.current.currentTime -= 10)}>-10s</button>
                <button onClick={() => (audioRef.current.currentTime += 10)}>+10s</button>
              </div>

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