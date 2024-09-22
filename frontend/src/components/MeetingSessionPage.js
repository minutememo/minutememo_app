import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import ActionPoints from './ActionPoints';

const MeetingSessionPage = () => {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [transcription, setTranscription] = useState('');
  const [shortSummary, setShortSummary] = useState('');
  const [longSummary, setLongSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [actionPoints, setActionPoints] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isTranscriptionExpanded, setIsTranscriptionExpanded] = useState(false); // New state for collapsible transcription
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
          setShortSummary(sessionData.short_summary || '');
          setLongSummary(sessionData.long_summary || '');
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

  // Function to handle reordering action points
  const handleReorder = (newOrder) => {
    setActionPoints(newOrder);
  };

  // Function to handle toggling of completion status
  const handleToggleComplete = (id) => {
    setActionPoints(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

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

  // Function to handle summarization
  const handleSummarize = async () => {
    setIsSummarizing(true);
    try {
      const response = await axios.post(`${backendUrl}/api/sessions/${sessionId}/summarize`);
      if (response.status === 200) {
        setShortSummary(response.data.short_summary);
        setLongSummary(response.data.long_summary);
      } else {
        setError('Failed to summarize.');
      }
    } catch (err) {
      setError('Error summarizing.');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Toggle transcription expand/collapse
  const toggleTranscription = () => {
    setIsTranscriptionExpanded(!isTranscriptionExpanded);
  };

  return (
    <div className="session-page">
      {error && <p className="error-message">{error}</p>}
      {session ? (
        <div>
          <h2>{session.name}</h2>
          <p>Date: {new Date(session.session_datetime).toLocaleString()}</p>

          {/* Collapsible Transcription */}
          <div className="transcription-container">
            <button onClick={toggleTranscription}>
              {isTranscriptionExpanded ? 'Collapse Transcription' : 'Expand Transcription'}
            </button>
            {isTranscriptionExpanded && transcription && (
              <div className="transcription" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px' }}>
                <h3>Transcription:</h3>
                <p>{transcription}</p>
              </div>
            )}
          </div>

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

              <button onClick={handleSummarize} disabled={isSummarizing}>
                {isSummarizing ? 'Summarizing...' : 'Summarize'}
              </button>

              {/* Short Summary */}
              {shortSummary && (
                <div>
                  <h3>Short Summary:</h3>
                  <div dangerouslySetInnerHTML={{ __html: shortSummary }} />  {/* Render HTML safely */}
                </div>
              )}

              {/* Long Summary */}
              {longSummary && (
                <div>
                  <h3>Long Summary:</h3>
                  <div dangerouslySetInnerHTML={{ __html: longSummary }} />  {/* Render HTML safely */}
                </div>
              )}

              {/* Action Points */}
              <ActionPoints
                actionPoints={actionPoints}
                onReorder={handleReorder}
                onToggleComplete={handleToggleComplete}
              />
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