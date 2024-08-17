import React, { createContext, useState, useEffect, useRef } from 'react';

export const TimerContext = createContext();

export const TimerProvider = ({ children }) => {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        setSeconds(prevSeconds => prevSeconds + 1);
      }, 1000);
    } else if (!isActive && intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isActive]);

  const startTimer = () => {
    setIsActive(true);
  };

  const stopTimer = () => {
    setIsActive(false);
  };

  return (
    <TimerContext.Provider value={{ seconds, isActive, startTimer, stopTimer }}>
      {children}
    </TimerContext.Provider>
  );
};