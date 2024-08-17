import React from 'react';
import { useUser } from '../UserContext';  // Import useUser correctly

const UserEmailDisplay = () => {
  const { user } = useUser();

  return (
    <div>
      {user ? (
        <p>Logged in as: {user.email}</p>
      ) : (
        <p>No user is logged in.</p>
      )}
    </div>
  );
};

export default UserEmailDisplay;