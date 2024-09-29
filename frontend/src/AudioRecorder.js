import React, { useContext, useEffect, useCallback, useState } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import './styles.css';
import { RecorderContext } from './RecorderContext';
import { useUser } from './UserContext';
import { FormControl } from 'react-bootstrap';

const AudioRecorder = ({ sessionId }) => {  
  const { user } = useUser(); 
  const {
    recording, setRecording, mediaRecorderRef, audioChunksRef,
    canvasRef, audioCtxRef, sourceRef, animationFrameIdRef, chunkNumberRef,
    recordingIdRef, streamRef, stopRef
  } = useContext(RecorderContext);
  const [selectedHub, setSelectedHub] = useState(null); 

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  // Ensure the canvas is available before drawing
  const draw = useCallback((array) => {
    const canvas = canvasRef.current;
    
    // Ensure the canvas element is available before trying to draw
    if (!canvas) {
      console.warn("Canvas element is not available.");
      return; // Stop drawing if canvas is not available
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Failed to get canvas context.");
      return;
    }

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
    if (!recording) {
      cancelAnimationFrame(animationFrameIdRef.current); // Stop visualizer if not recording
      return;
    }

    const visualize = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.warn("Canvas element is not available. Stopping visualizer.");
        cancelAnimationFrame(animationFrameIdRef.current); // Stop visualizer if canvas is unavailable
        return;
      }

      if (!sourceRef.current) return;

      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      sourceRef.current.connect(analyser);
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const drawVisualizer = () => {
        analyser.getByteFrequencyData(dataArray);
        draw(dataArray);

        // Only request animation frame if recording is still active and canvas exists
        if (canvasRef.current && recording) {
          animationFrameIdRef.current = requestAnimationFrame(drawVisualizer);
        }
      };

      drawVisualizer();

      return () => cancelAnimationFrame(animationFrameIdRef.current);
    };

    visualize();
  }, [recording, audioCtxRef, sourceRef, draw, animationFrameIdRef]);

  const startRecording = async () => {
    console.log("Attempting to start recording...");
  
    // Ensure sessionId is provided
    if (!sessionId) {
      console.error("No session ID provided. Recording cannot start without a session.");
      alert("No session found. Please start a session before recording.");
      return;
    }

    // Initialize recording session
    recordingIdRef.current = uuidv4();
    chunkNumberRef.current = 0; // Reset chunk number

    try {
      const response = await axios.post(`${backendUrl}/api/recordings`, {
        recording_id: recordingIdRef.current,
        file_name: `${recordingIdRef.current}.webm`,
        concatenation_status: 'pending',
        concatenation_file_name: `${recordingIdRef.current}_list.txt`,
        meeting_session_id: sessionId,  // Link to the provided sessionId
      });

      console.log('Recording entry creation response:', response);

      if (response.status === 201) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            sourceRef.current = audioCtxRef.current.createMediaStreamSource(stream);
            streamRef.current = stream;
            stopRef.current = false; // Reset stop flag
            startNewChunk();
            setRecording(true);
            console.log('Recording started successfully.');
          })
          .catch(error => {
            console.error('Error accessing the microphone:', error);
            if (error.name === 'NotAllowedError') {
              alert('Microphone access was denied. Please allow access to record.');
            } else if (error.name === 'NotReadableError') {
              alert('Microphone is currently being used by another application.');
            } else {
              alert('An error occurred while trying to access the microphone.');
            }
          });
      } else {
        console.error('Failed to create recording entry in the database.');
      }
    } catch (error) {
      console.error('Error encountered while creating recording entry in the database:', error);
    }
  };

  const startNewChunk = () => {
    if (stopRef.current) return; 

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
        setTimeout(startNewChunk, 0); 
      }
    };

    mediaRecorderRef.current.start(5000); 
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
      console.log('Starting concatenation for recording ID:', recordingIdRef.current);

      const response = await axios.post(`${backendUrl}/concatenate`, {
        recording_id: recordingIdRef.current,
      });

      if (response.status === 200) {
        const audioUrl = response.data.file_url;
        console.log('Concatenation successful. Audio file URL:', audioUrl);

        console.log(`Updating recording ${recordingIdRef.current} with audio URL: ${audioUrl}`);
        await axios.patch(`${backendUrl}/api/recordings/${recordingIdRef.current}`, {
          audio_url: audioUrl,
        });

        console.log('Audio URL successfully stored in the database');
      } else {
        console.error('Concatenation failed:', response.data.message);
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

  const stopRecording = async () => {
    stopRef.current = true; 
    setRecording(false);

    // Stop visualizer once recording is stopped
    cancelAnimationFrame(animationFrameIdRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    await concatenateChunks();

    try {
      console.log("Starting transcription...");
      const transcriptionResponse = await axios.post(`${backendUrl}/api/transcribe/${sessionId}`);
      if (transcriptionResponse.status === 200) {
        console.log("Transcription successful:", transcriptionResponse.data);

        console.log("Starting summarization...");
        const summaryResponse = await axios.post(`${backendUrl}/api/sessions/${sessionId}/summarize`);
        if (summaryResponse.status === 200) {
          console.log("Summarization successful:", summaryResponse.data);

          console.log("Starting action point extraction...");
          const actionPointsResponse = await axios.post(`${backendUrl}/api/extract_action_points/${sessionId}`);
          if (actionPointsResponse.status === 200) {
            console.log("Action points extraction successful:", actionPointsResponse.data);
          } else {
            console.error("Error extracting action points:", actionPointsResponse.data);
          }
        } else {
          console.error("Error during summarization:", summaryResponse.data);
        }
      } else {
        console.error("Error during transcription:", transcriptionResponse.data);
      }
    } catch (error) {
      console.error("Error during transcription, summarization, or action point extraction:", error);
    }
  };

  return (
    <div className="audio-recorder">
      <h1>Audio Recorder</h1>
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