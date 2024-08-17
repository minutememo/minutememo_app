import React, { createContext, useRef, useState } from 'react';

export const RecorderContext = createContext();

export const RecorderProvider = ({ children }) => {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const chunkNumberRef = useRef(0);
  const recordingIdRef = useRef(null);
  const streamRef = useRef(null);
  const stopRef = useRef(false);

  return (
    <RecorderContext.Provider value={{
      recording, setRecording, mediaRecorderRef, audioChunksRef, canvasRef,
      audioCtxRef, sourceRef, animationFrameIdRef, chunkNumberRef,
      recordingIdRef, streamRef, stopRef
    }}>
      {children}
    </RecorderContext.Provider>
  );
};