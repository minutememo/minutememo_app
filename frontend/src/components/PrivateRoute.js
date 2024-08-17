// src/components/PrivateRoute.js
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from '../UserContext';

const PrivateRoute = () => {
  const { user } = useUser();

  return user ? <Outlet /> : <Navigate to="/login" />;
};

export default PrivateRoute;