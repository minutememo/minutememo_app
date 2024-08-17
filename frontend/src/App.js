import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, NavLink } from 'react-router-dom';
import { Container, Row, Col, Form, FormControl, Button, Navbar, Nav } from 'react-bootstrap';
import './styles.css';
import AudioRecorder from './AudioRecorder';
import { RecorderProvider } from './RecorderContext';
import { UserProvider, useUser } from './UserContext';
import DashboardPage from './components/DashboardPage';
import MeetingsPage from './components/MeetingsPage';
import ActionItemsPage from './components/ActionItemsPage';
import SettingsPage from './components/SettingsPage';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import UserEmailDisplay from './components/UserEmailDisplay';
import LogoutButton from './components/LogoutButton';
import axios from 'axios';

axios.defaults.withCredentials = true; // Ensure cookies are sent with every request

const AppContent = () => {
  const { user } = useUser(); // Get user from the context

  useEffect(() => {
    console.log(user ? `Page loaded with user: ${user.email}` : "Page loaded with no user logged in.");
  }, [user]);

  return (
    <Router>
      {/* Only show the navbar and other components if the user is logged in */}
      {user ? (
        <>
          <Navbar bg="dark" variant="dark" className="mb-4">
            <Container fluid>
              <Navbar.Brand as={NavLink} to="/">MinuteMemo</Navbar.Brand>
              <Form className="d-flex">
                <FormControl
                  type="search"
                  placeholder="Search"
                  className="mr-2"
                  aria-label="Search"
                />
                <Button variant="outline-success">Search</Button>
              </Form>
              <LogoutButton /> {/* Show logout button if the user is logged in */}
            </Container>
          </Navbar>

          <Container fluid>
            <Row>
              <Col md={3} className="bg-light sidebar">
                <Nav defaultActiveKey="/" className="flex-column">
                  <NavLink to="/" className="nav-link">Dashboard</NavLink>
                  <NavLink to="/meetings" className="nav-link">Meetings</NavLink>
                  <NavLink to="/action-items" className="nav-link">Action Items</NavLink>
                  <NavLink to="/settings" className="nav-link">Settings</NavLink>
                </Nav>
                <UserEmailDisplay /> {/* Display the user email here if logged in */}
                <AudioRecorder /> {/* Display AudioRecorder only if user is logged in */}
              </Col>
              <Col md={9} className="content">
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/meetings" element={<MeetingsPage />} />
                  <Route path="/action-items" element={<ActionItemsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Col>
            </Row>
          </Container>
        </>
      ) : (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Routes>
      )}
    </Router>
  );
};

const App = () => (
  <UserProvider>
    <RecorderProvider> {/* Moved RecorderProvider here to cover the whole app */}
      <AppContent />
    </RecorderProvider>
  </UserProvider>
);

export default App;