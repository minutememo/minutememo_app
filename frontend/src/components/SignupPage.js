import React, { useEffect } from 'react';
import './SubscribePage.css'; // Import the styles for the modal

const SubscribePage = () => {
  // Prevent scrolling when the modal is active
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div className="subscription-modal">
      <div className="modal-content">
        <h1>This is the subscription page</h1>
        <p>Please subscribe to continue using the service.</p>
      </div>
    </div>
  );
};

export default SubscribePage;