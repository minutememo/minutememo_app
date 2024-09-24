import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ShortSummary = ({ sessionId, backendUrl }) => {
  const [shortSummary, setShortSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchShortSummary = async () => {
      try {
        const response = await axios.get(`${backendUrl}/api/sessions/${sessionId}/short_summary`);
        if (response.status === 200) {
          setShortSummary(response.data.short_summary);
        } else {
          setError('Failed to fetch short summary.');
        }
      } catch (err) {
        setError('Error fetching short summary.');
      }
    };

    fetchShortSummary();
  }, [sessionId, backendUrl]);

  const handleSummarize = async () => {
    setIsSummarizing(true);
    try {
      const response = await axios.post(`${backendUrl}/api/sessions/${sessionId}/summarize_short`);
      if (response.status === 200) {
        setShortSummary(response.data.short_summary);
      } else {
        setError('Failed to summarize.');
      }
    } catch (err) {
      setError('Error summarizing.');
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div>
      {error && <p className="error-message">{error}</p>}
      <h3>Short Summary:</h3>
      {shortSummary ? (
        <div dangerouslySetInnerHTML={{ __html: shortSummary }} />
      ) : (
        <p>No short summary available.</p>
      )}
      <button onClick={handleSummarize} disabled={isSummarizing}>
        {isSummarizing ? 'Summarizing...' : 'Summarize'}
      </button>
    </div>
  );
};

export default ShortSummary;