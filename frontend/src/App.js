import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, NavLink } from 'react-router-dom';
import { Container, Row, Col, Form, FormControl, Button, Navbar, Nav, Dropdown, Modal } from 'react-bootstrap';
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
  const [meetingHubs, setMeetingHubs] = useState([]);
  const [selectedHub, setSelectedHub] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newHubName, setNewHubName] = useState("");

  useEffect(() => {
    if (user) {
      fetchMeetingHubs();
    }
  }, [user]);

  const fetchMeetingHubs = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/meetinghubs');
      if (response.status === 200) {
        const hubs = response.data.meeting_hubs || [];
        setMeetingHubs(hubs);
        if (hubs.length > 0) {
          setSelectedHub(hubs[0]?.id); // Select the first hub by default
        }
      }
    } catch (err) {
      console.error('Error fetching meeting hubs:', err);
    }
  };

  const handleCreateHub = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/meetinghubs', { name: newHubName });
      if (response.status === 201) {
        setMeetingHubs(prevHubs => [...prevHubs, response.data.meeting_hub]);
        setNewHubName("");
        setShowModal(false);
      }
    } catch (err) {
      console.error('Error creating meeting hub:', err);
    }
  };

  return (
    <Router>
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

              {/* Meeting Hubs Dropdown */}
              <Dropdown>
                <Dropdown.Toggle variant="success" id="dropdown-basic">
                  {selectedHub ? meetingHubs.find(hub => hub.id === selectedHub)?.name || 'Unnamed Hub' : 'Select Meeting Hub'}
                </Dropdown.Toggle>

                <Dropdown.Menu>
                  {meetingHubs.length > 0 ? meetingHubs.map(hub => (
                    <Dropdown.Item key={hub.id} onClick={() => setSelectedHub(hub.id)}>
                      {hub.name || 'Unnamed Hub'}
                    </Dropdown.Item>
                  )) : (
                    <Dropdown.Item disabled>No hubs available</Dropdown.Item>
                  )}
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={() => setShowModal(true)}>Create New Hub</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>

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
                <AudioRecorder selectedHub={selectedHub} /> {/* Pass selectedHub to AudioRecorder */}
              </Col>
              <Col md={9} className="content">
                <Routes>
                  <Route path="/" element={<DashboardPage selectedHub={selectedHub} />} />
                  <Route path="/meetings" element={<MeetingsPage />} />
                  <Route path="/action-items" element={<ActionItemsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Col>
            </Row>
          </Container>

          {/* Modal for Creating New Hub */}
          <Modal show={showModal} onHide={() => setShowModal(false)}>
            <Modal.Header closeButton>
              <Modal.Title>Create New Meeting Hub</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <FormControl
                type="text"
                placeholder="Enter hub name"
                value={newHubName}
                onChange={(e) => setNewHubName(e.target.value)}
              />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateHub}>
                Create Hub
              </Button>
            </Modal.Footer>
          </Modal>
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
    <RecorderProvider>
      <AppContent />
    </RecorderProvider>
  </UserProvider>
);

export default App;