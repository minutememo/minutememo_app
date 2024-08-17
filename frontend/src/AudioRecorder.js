import React, { useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import './styles.css';
import { RecorderContext } from './RecorderContext';

axios.defaults.withCredentials = true; // Ensure credentials are included with every axios request

const AudioRecorder = () => {
  const {
    recording, setRecording, mediaRecorderRef, audioChunksRef,
    canvasRef, audioCtxRef, sourceRef, animationFrameIdRef, chunkNumberRef,
    recordingIdRef, streamRef, stopRef
  } = useContext(RecorderContext);

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
    console.log("Recording started");
    
    recordingIdRef.current = uuidv4();
    chunkNumberRef.current = 0; // Reset chunk number
    
    try {
      // Make an API call to create a new recording entry in the database
      const response = await axios.post('http://localhost:5000/api/recordings', {
        recording_id: recordingIdRef.current, // Pass the generated recording ID
        file_name: `${recordingIdRef.current}.webm`, // Use the same recording ID for the file name
        concatenation_status: 'pending', // Set initial concatenation status to pending
        concatenation_file_name: `${recordingIdRef.current}_list.txt`, // Use the same recording ID for the concatenation list file
      });
  
      if (response.status === 201) {
        console.log('Recording entry created in the database.');

        // Proceed with the recording if the entry was successfully created
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
          sourceRef.current = audioCtxRef.current.createMediaStreamSource(stream);
          streamRef.current = stream;
          stopRef.current = false;  // Reset stop flag
          startNewChunk();
    
          setRecording(true);
        });
      } else {
        console.error('Failed to create recording entry in the database.');
      }
    } catch (error) {
      console.error('Error creating recording entry in the database:', error);
    }
  };

  const startNewChunk = () => {
    if (stopRef.current) return;  // Don't start new chunk if stopping

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
    console.log(`Uploading chunk ${chunkNumberRef.current} for recording ID ${recordingIdRef.current}`);
    chunkNumberRef.current++;

    axios.post('http://localhost:5000/upload_chunk', formData)
      .then(response => {
        console.log(`Chunk ${chunkNumberRef.current - 1} uploaded successfully`);
      })
      .catch(error => {
        console.error(`Error uploading chunk ${chunkNumberRef.current - 1}:`, error);
      });
  };

  const concatenateChunks = async () => {
    try {
        const response = await axios.post('http://localhost:5000/concatenate', {
            recording_id: recordingIdRef.current // Ensure this value is correct and not null/undefined
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            console.log('Concatenation successful:', response.data.file_url);
        } else {
            console.error('Concatenation failed:', response.data.message);
        }
    } catch (error) {
        console.error('Error concatenating chunks:', error);
    }
  };

  const stopRecording = () => {
    console.log("Recording stopped");
    stopRef.current = true;  // Set stop flag
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