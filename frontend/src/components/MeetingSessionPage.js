import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import ActionPoints from './ActionPoints';
import '../styles.css'; // Assuming styles.css is in the src folder


const MeetingSessionPage = () => {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [transcription, setTranscription] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [actionPoints, setActionPoints] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isTranscriptionExpanded, setIsTranscriptionExpanded] = useState(false);
  const [summaries, setSummaries] = useState({ short: '', long: '' }); // Store both summaries
  const audioRef = useRef(null);

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        // Fetch session data
        const sessionResponse = await axios.get(`${backendUrl}/api/sessions/${sessionId}`);
        if (sessionResponse.status === 200) {
          const sessionData = sessionResponse.data.session;
          setSession(sessionData);
          setTranscription(sessionData.transcription || '');
        } else {
          setError('Failed to fetch session.');
        }
  
        // Fetch summaries (short and long)
        const summariesResponse = await axios.get(`${backendUrl}/api/sessions/${sessionId}/summaries`);
        if (summariesResponse.status === 200) {
          setSummaries({
            short: summariesResponse.data.short_summary || 'No short summary available',
            long: summariesResponse.data.long_summary || 'No long summary available',
          });
        } else {
          setError('Failed to fetch summaries.');
        }
  
        // Fetch action points
        const actionPointsResponse = await axios.get(`${backendUrl}/api/sessions/${sessionId}/action_points`);
        if (actionPointsResponse.status === 200) {
          setActionPoints(actionPointsResponse.data.action_items);
        } else {
          setError('Failed to fetch action points.');
        }
      } catch (err) {
        setError('Error fetching data.');
      }
    };
  
    fetchSessionData();
  }, [sessionId, backendUrl]);

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

  // Function to handle updating action point title
  const handleUpdateTitle = async (id, newTitle) => {
    try {
      const response = await axios.put(`${backendUrl}/api/sessions/${sessionId}/action_points/${id}`, { title: newTitle });
      if (response.status === 200) {
        setActionPoints(prevItems =>
          prevItems.map(item =>
            item.id === id ? { ...item, title: newTitle } : item
          )
        );
      } else {
        setError('Failed to update action point.');
      }
    } catch (err) {
      setError('Error updating action point.');
    }
  };

  // Function to handle adding a new action point
  const handleAddActionPoint = async (title) => {
    try {
      const response = await axios.post(`${backendUrl}/api/sessions/${sessionId}/action_points`, { title });
      if (response.status === 201) {
        const newActionPoint = response.data.action_item;
        setActionPoints(prevItems => [...prevItems, newActionPoint]);
      } else {
        setError('Failed to add action point.');
      }
    } catch (err) {
      setError('Error adding action point.');
    }
  };

  // Function to handle transcription
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

  // Function to handle summarization
  const handleSummarize = async () => {
    setIsSummarizing(true);
    try {
      const response = await axios.post(`${backendUrl}/api/sessions/${sessionId}/summarize`);
      if (response.status === 200) {
        setSummaries({
          short: response.data.short_summary,
          long: response.data.long_summary,
        });
      } else {
        setError('Failed to summarize.');
      }
    } catch (err) {
      setError('Error summarizing.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleExtractActionPoints = async () => {
    setIsExtracting(true);
    try {
      // Call the backend to extract action points from the transcription
      const response = await axios.post(`${backendUrl}/api/extract_action_points/${sessionId}`, {}, {
        headers: { 'Content-Type': 'application/json' }
      });
  
      if (response.status === 200) {
        // Action points successfully extracted
        console.log('Action points extracted successfully:', response.data);
        setActionPoints(response.data.action_items);  // Assuming the response contains action items
      } else {
        setError('Failed to extract action points.');
      }
    } catch (err) {
      setError('Error extracting action points.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Toggle transcription display
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

            <button onClick={handleSummarize} disabled={isSummarizing}>
              {isSummarizing ? 'Summarizing...' : 'Generate Summaries'}
            </button>

            <button onClick={handleExtractActionPoints} disabled={isExtracting}>
              {isExtracting ? 'Extracting Action Points...' : 'Extract Action Points'}
            </button>

            {/* Display Summaries Side by Side */}
            <div className="summary-wrapper">
              <div className="summary-container">
                <h3>Short Summary</h3>
                {summaries.short ? (
                  <div dangerouslySetInnerHTML={{ __html: summaries.short }} />
                ) : (
                  <p>No short summary available.</p>
                )}
              </div>
              <div className="summary-container">
                <h3>Long Summary</h3>
                {summaries.long ? (
                  <div dangerouslySetInnerHTML={{ __html: summaries.long }} />
                ) : (
                  <p>No long summary available.</p>
                )}
              </div>
            </div>

            {/* Action Points Component */}
            <ActionPoints
              actionPoints={actionPoints}
              onReorder={handleReorder}
              onToggleComplete={handleToggleComplete}
              onUpdateTitle={handleUpdateTitle}
              onAddActionPoint={handleAddActionPoint}
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