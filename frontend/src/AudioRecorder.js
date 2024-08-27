import React, { useContext, useEffect, useCallback, useState } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import './styles.css';
import { RecorderContext } from './RecorderContext';
import { useUser } from './UserContext';
import { FormControl } from 'react-bootstrap';

axios.defaults.withCredentials = true; // Ensure credentials are included with every axios request

const AudioRecorder = ({ selectedHub, setSelectedHub }) => {  // Accept selectedHub as a prop
  const { user } = useUser(); // Get user from context
  const {
    recording, setRecording, mediaRecorderRef, audioChunksRef,
    canvasRef, audioCtxRef, sourceRef, animationFrameIdRef, chunkNumberRef,
    recordingIdRef, streamRef, stopRef, meetingSessionId // Add meetingSessionId to context
  } = useContext(RecorderContext);
  const [meetingName, setMeetingName] = useState("");

  // Environment variable for backend URL
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  const draw = useCallback((array) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const barWidth = 10;
    const barSpacing = 2;
    const topRoundness = 2;
    const bottomRoundness = 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#18A04F';

    for (let i = 0; i < array.length; i++) {
      const barHeight = array[i] / 2;
      const x = i * (barWidth + barSpacing);
      const y = height - barHeight;

      ctx.beginPath();
      ctx.moveTo(x, y + topRoundness);
      ctx.quadraticCurveTo(x, y, x + topRoundness, y);
      ctx.lineTo(x + barWidth - topRoundness, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + topRoundness);
      ctx.lineTo(x + barWidth, y + barHeight - bottomRoundness);
      ctx.quadraticCurveTo(x + barWidth, y + barHeight, x + barWidth - bottomRoundness, y + barHeight);
      ctx.lineTo(x + bottomRoundness, y + barHeight);
      ctx.quadraticCurveTo(x, y + barHeight, x, y + barHeight - bottomRoundness);
      ctx.closePath();
      ctx.fill();
    }
  }, [canvasRef]);

  useEffect(() => {
    if (!recording) return;

    const visualize = () => {
      if (!sourceRef.current) return;

      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      sourceRef.current.connect(analyser);
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const drawVisualizer = () => {
        analyser.getByteFrequencyData(dataArray);
        draw(dataArray);
        animationFrameIdRef.current = requestAnimationFrame(drawVisualizer);
      };

      drawVisualizer();

      return () => cancelAnimationFrame(animationFrameIdRef.current);
    };

    visualize();
  }, [recording, audioCtxRef, sourceRef, draw, animationFrameIdRef]);

  const startRecording = async () => {
    console.log("Attempting to start recording...");
    console.log("Meeting Name:", meetingName);
    console.log("Selected Hub:", selectedHub);
  
    // Check if the meeting name is provided
    if (!meetingName) {
      console.error("No meeting name provided. Please enter a meeting name before starting the recording.");
      alert("Please enter a meeting name before starting the recording.");
      return;
    }
  
    // If selectedHub is not defined, attempt to fetch it using the same logic as in fetchMeetingHubs
    if (!selectedHub) {
      console.warn("No selected hub found. Attempting to fetch active hub ID...");
      
      try {
        const response = await axios.get(`${backendUrl}/api/meetinghubs`);
        console.log('API response received:', response);
  
        if (response.status === 200) {
          const hubs = response.data.meeting_hubs || [];
          console.log('Fetched meeting hubs:', hubs);
          if (hubs.length > 0) {
            const activeHubId = parseInt(response.data.active_hub_id, 10) || hubs[0]?.id;
            console.log('Active Hub ID from API:', activeHubId);
  
            // Set the active hub in state
            setSelectedHub(activeHubId);
            console.log('Selected hub state updated:', activeHubId);
  
            if (!activeHubId) {
              console.error("No active hub found. Please select a meeting hub before starting the recording.");
              alert("Please select a meeting hub before starting the recording.");
              return;
            }
          } else {
            console.error("No meeting hubs found. Cannot proceed with recording.");
            alert("No meeting hubs found. Please create or select a hub before starting the recording.");
            return;
          }
        } else {
          console.error('Unexpected response status:', response.status);
          alert("Unexpected error occurred while fetching meeting hubs.");
          return;
        }
      } catch (err) {
        console.error('Error fetching meeting hubs:', err);
        alert("An error occurred while fetching meeting hubs. Please try again.");
        return;
      }
    }
  
    // Initialize recording session
    recordingIdRef.current = uuidv4();
    chunkNumberRef.current = 0; // Reset chunk number
  
    try {
      // Log the hub ID being used for the request
      console.log('Using Selected Hub ID:', selectedHub);
  
      // Create the meeting and meeting session
      const meetingResponse = await axios.post(`${backendUrl}/api/meetings`, {
        name: meetingName,
        hub_id: selectedHub,
      });
  
      console.log('Meeting and session creation response:', meetingResponse);
  
      const meetingSessionId = meetingResponse.data.meeting_session_id;
      console.log('Created Meeting Session ID:', meetingSessionId);
  
      const response = await axios.post(`${backendUrl}/api/recordings`, {
        recording_id: recordingIdRef.current,
        file_name: `${recordingIdRef.current}.webm`,
        concatenation_status: 'pending',
        concatenation_file_name: `${recordingIdRef.current}_list.txt`,
        meeting_session_id: meetingSessionId,
      });
  
      console.log('Recording entry creation response:', response);
  
      if (response.status === 201) {
        console.log('Recording entry successfully created in the database.');
  
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
          sourceRef.current = audioCtxRef.current.createMediaStreamSource(stream);
          streamRef.current = stream;
          stopRef.current = false; // Reset stop flag
          startNewChunk();
  
          setRecording(true);
          console.log('Recording started successfully.');
        });
      } else {
        console.error('Failed to create recording entry in the database.');
      }
    } catch (error) {
      console.error('Error encountered while creating recording entry in the database:', error);
  
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      }
    }
  };

  const startNewChunk = () => {
    if (stopRef.current) return; // Don't start new chunk if stopping

    mediaRecorderRef.current = new MediaRecorder(streamRef.current);

    mediaRecorderRef.current.ondataavailable = event => {
      audioChunksRef.current.push(event.data);
      if (mediaRecorderRef.current.state === 'recording') {
        uploadChunk(event.data);
        mediaRecorderRef.current.stop();
      }
    };

    mediaRecorderRef.current.onstop = () => {
      if (!stopRef.current) {
        setTimeout(startNewChunk, 0); // Delay for next chunk to ensure the current one is processed
      }
    };

    mediaRecorderRef.current.start(5000); // Record in 5-second intervals
  };

  const uploadChunk = (chunk) => {
    const formData = new FormData();
    formData.append('chunk', chunk, `chunk_${chunkNumberRef.current}.webm`);
    formData.append('chunk_number', chunkNumberRef.current);
    formData.append('recording_id', recordingIdRef.current);
    chunkNumberRef.current++;

    axios.post(`${backendUrl}/upload_chunk`, formData)
      .then(response => {
        console.log(`Chunk ${chunkNumberRef.current - 1} uploaded successfully`);
      })
      .catch(error => {
        console.error(`Error uploading chunk ${chunkNumberRef.current - 1}:`, error);
      });
  };

  const concatenateChunks = async () => {
    try {
        // Log the start of the concatenation process
        console.log('Starting concatenation for recording ID:', recordingIdRef.current);

        // Send request to concatenate chunks
        const response = await axios.post(`${backendUrl}/concatenate`, {
            recording_id: recordingIdRef.current,
        });

        if (response.status === 200) {
            const audioUrl = response.data.file_url;
            console.log('Concatenation successful. Audio file URL:', audioUrl);

            // Log the PATCH request to update the recording with the audio_url
            console.log(`Updating recording ${recordingIdRef.current} with audio URL: ${audioUrl}`);
            await axios.patch(`${backendUrl}/api/recordings/${recordingIdRef.current}`, {
                audio_url: audioUrl,
            });

            console.log('Audio URL successfully stored in the database');
        } else {
            console.error('Concatenation failed. Message:', response.data.message);
        }
    } catch (error) {
        console.error('Error during concatenation or updating the recording:', error);

        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
        }
    }
};

  const stopRecording = () => {
    stopRef.current = true; // Set stop flag
    setRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    cancelAnimationFrame(animationFrameIdRef.current);

    concatenateChunks();
  };

  return (
    <div className="audio-recorder">
      <h1>Audio Recorder</h1>
      <FormControl
        type="text"
        placeholder="Enter meeting name"
        value={meetingName}
        onChange={(e) => setMeetingName(e.target.value)}
        disabled={recording}
      />
      <div className="controls">
        <button onClick={startRecording} disabled={recording}>Start Recording</button>
        <button onClick={stopRecording} disabled={!recording}>Stop Recording</button>
      </div>
      {recording && (
        <div className="visualizer">
          <canvas ref={canvasRef} width="300" height="100"></canvas>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;