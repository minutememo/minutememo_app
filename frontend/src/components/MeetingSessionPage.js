import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import ActionPoints from './ActionPoints';
import AudioRecorder from '../AudioRecorder';
import '../styles.css';

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
  const [summaries, setSummaries] = useState({ short: '', long: '' });
  const [selectedLanguage, setSelectedLanguage] = useState('en'); // Language selection state
  const audioRef = useRef(null);

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        const sessionResponse = await axios.get(`${backendUrl}/api/sessions/${sessionId}`);
        if (sessionResponse.status === 200) {
          const sessionData = sessionResponse.data.session;
          setSession(sessionData);
          setTranscription(sessionData.transcription || '');
        } else {
          setError('Failed to fetch session.');
        }

        const summariesResponse = await axios.get(`${backendUrl}/api/sessions/${sessionId}/summaries`);
        if (summariesResponse.status === 200) {
          setSummaries({
            short: summariesResponse.data.short_summary || 'No short summary available',
            long: summariesResponse.data.long_summary || 'No long summary available',
          });
        } else {
          setError('Failed to fetch summaries.');
        }

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

  // Function to handle transcription
  const handleTranscription = async () => {
    setIsTranscribing(true);
    try {
      const response = await axios.post(
        `${backendUrl}/api/transcribe/${sessionId}`, 
        { language: selectedLanguage },  // Include the selected language in the request body
        {
          headers: { 'Content-Type': 'application/json' }  // Ensure Content-Type is application/json
        }
      );
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

  // Function to handle extracting action points
  const handleExtractActionPoints = async () => {
    setIsExtracting(true);
    try {
      const response = await axios.post(`${backendUrl}/api/extract_action_points/${sessionId}`, {}, {
        headers: { 'Content-Type': 'application/json' }
      });

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

  // Function to reorder action points
  const handleReorder = (newOrder) => {
    setActionPoints(newOrder);
  };

  // Function to toggle the completion status of an action point
  const handleToggleComplete = async (id, completed) => {
    try {
      const response = await axios.put(`${backendUrl}/api/action_item/${id}/complete`, {
        completed: !completed,
      });

      if (response.status === 200) {
        setActionPoints(prevItems =>
          prevItems.map(item =>
            item.id === id ? { ...item, completed: !completed } : item
          )
        );
      } else {
        setError('Failed to update action point.');
      }
    } catch (err) {
      setError('Error updating action point.');
    }
  };

  // Function to update the title of an action point
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

  // Function to add a new action point
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

  // Toggle function for transcription expansion
  const toggleTranscription = () => {
    setIsTranscriptionExpanded(!isTranscriptionExpanded);
  };

  return (
    <div className="session-page">
      <AudioRecorder sessionId={sessionId} /> {/* Recorder is now fixed at the top */}
      {error && <p className="error-message">{error}</p>}
      {session ? (
        <div>
          <h2>{session.name}</h2>
          <p>Date: {new Date(session.session_datetime).toLocaleString()}</p>

          <div>
            <label htmlFor="language-select">Select Transcription Language:</label>
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)} // Handle language selection
            >
              <option value="en">English</option>
              <option value="nl">Dutch</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="es">Spanish</option>
            </select>
          </div>

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