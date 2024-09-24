import React, { useState, useEffect } from 'react';
import axios from 'axios';

const LongSummary = ({ sessionId, backendUrl }) => {
  const [longSummary, setLongSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLongSummary = async () => {
      try {
        const response = await axios.get(`${backendUrl}/api/sessions/${sessionId}/long_summary`);
        if (response.status === 200) {
          setLongSummary(response.data.long_summary);
        } else {
          setError('Failed to fetch long summary.');
        }
      } catch (err) {
        setError('Error fetching long summary.');
      }
    };

    fetchLongSummary();
  }, [sessionId, backendUrl]);

  const handleSummarize = async () => {
    setIsSummarizing(true);
    try {
      const response = await axios.post(`${backendUrl}/api/sessions/${sessionId}/summarize_long`);
      if (response.status === 200) {
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

  return (
    <div>
      {error && <p className="error-message">{error}</p>}
      <h3>Long Summary:</h3>
      {longSummary ? (
        <div dangerouslySetInnerHTML={{ __html: longSummary }} />
      ) : (
        <p>No long summary available.</p>
      )}
      <button onClick={handleSummarize} disabled={isSummarizing}>
        {isSummarizing ? 'Summarizing...' : 'Summarize'}
      </button>
    </div>
  );
};

export default LongSummary;