import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, NavLink } from 'react-router-dom';
import { Container, Row, Col, Form, FormControl, Button, Navbar, Nav, Dropdown, Modal, Spinner } from 'react-bootstrap';
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
  const [activeHubName, setActiveHubName] = useState('Select Meeting Hub');
  const [showModal, setShowModal] = useState(false);
  const [newHubName, setNewHubName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [dropdownVisible, setDropdownVisible] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMeetingHubs();
    }
  }, [user]);

  const fetchMeetingHubs = async () => {
    console.log('fetchMeetingHubs called');
    try {
        setIsLoading(true);
        console.log('Fetching meeting hubs from API...');
        const response = await axios.get('http://localhost:5000/api/meetinghubs');
        console.log('API response received:', response);

        if (response.status === 200) {
            const hubs = response.data.meeting_hubs || [];
            console.log('Fetched meeting hubs:', hubs);
            
            if (hubs.length > 0) {
                const activeHubId = parseInt(response.data.active_hub_id, 10) || hubs[0]?.id;
                console.log('Active Hub ID from API:', activeHubId);

                // Log the type of activeHubId and the IDs in the meetingHubs array
                console.log('Type of activeHubId:', typeof activeHubId);
                hubs.forEach(hub => console.log('Hub ID:', hub.id, 'Type:', typeof hub.id));

                setMeetingHubs(hubs); // Set meeting hubs in state
                setSelectedHub(activeHubId); // Set the active hub in state
                console.log('Selected hub state updated:', activeHubId);

                // Now that the hubs state is updated, we can safely update the active hub name
                updateActiveHubName(activeHubId, hubs);
            } else {
                console.log('No hubs found in the response.');
                setSelectedHub(null); // Handle the case where there are no hubs
                setActiveHubName('No Meeting Hub Selected');
            }
        } else {
            console.error('Unexpected response status:', response.status);
        }
    } catch (err) {
        console.error('Error fetching meeting hubs:', err);
    } finally {
        console.log('Finished fetching meeting hubs.');
        setIsLoading(false);
    }
};

const updateActiveHubName = (hubId, hubs = meetingHubs) => {
  console.log('updateActiveHubName called with hubId:', hubId);

  // Ensure hubId is compared as a number
  const hub = hubs.find(hub => hub.id === parseInt(hubId, 10));

  console.log('Meeting hubs array during updateActiveHubName:', hubs);

  if (hub) {
      console.log('Hub found in updateActiveHubName:', hub);
      setActiveHubName(hub.name);
  } else {
      console.log('Hub not found in updateActiveHubName');
      setActiveHubName('No Meeting Hub Selected');
  }
};
const handleCreateHub = async () => {
  if (!newHubName.trim()) {
    alert("Please enter a hub name.");
    return;
  }

  const tempHub = { id: `temp-${Date.now()}`, name: newHubName };
  setMeetingHubs(prevHubs => [...prevHubs, tempHub]);
  setSelectedHub(tempHub.id); // Temporarily select the new hub
  setActiveHubName(tempHub.name); // Update the active hub name with the temporary name

  try {
    setIsLoading(true);
    setError('');

    const response = await axios.post('http://localhost:5000/api/meetinghubs', { name: newHubName });

    if (response.status === 201 && response.data && response.data.meeting_hub) {
      const createdHub = response.data.meeting_hub;
      setMeetingHubs(prevHubs => prevHubs.map(hub => hub.id === tempHub.id ? createdHub : hub));
      setSelectedHub(createdHub.id); // Select the newly created hub
      setActiveHubName(createdHub.name); // Update the active hub name with the newly created hub
      await setActiveHub(createdHub.id); // Store the active hub in the database
    } else {
      setError('Failed to create meeting hub');
      setMeetingHubs(prevHubs => prevHubs.filter(hub => hub.id !== tempHub.id)); // Remove the temporary hub
      setActiveHubName('No Meeting Hub Selected');
    }
  } catch (err) {
    console.error('Error creating meeting hub:', err);
    setError('Error creating meeting hub');
    setMeetingHubs(prevHubs => prevHubs.filter(hub => hub.id !== tempHub.id)); // Remove the temporary hub
    setActiveHubName('No Meeting Hub Selected');
  } finally {
    setIsLoading(false);
    setNewHubName(""); // Clear the input field after creation
    setShowModal(false); // Close the modal after creation
  }
};

const handleHubSelect = async (hubId) => {
  try {
      console.log('handleHubSelect called with hubId:', hubId);

      // Store the active hub in the backend
      await setActiveHub(hubId);

      // Update the selected hub state
      setSelectedHub(hubId);
      console.log('selectedHub state updated:', hubId);

      // Log current meetingHubs before updating the active hub name
      console.log('Current meetingHubs array:', meetingHubs);

      // Update the active hub name in the UI after the state is set
      updateActiveHubName(hubId);

      // Close the dropdown
      setDropdownVisible(false);
      console.log('Dropdown closed');
  } catch (err) {
      console.error('Error selecting hub:', err);
  }
};

const setActiveHub = async (hubId) => {
  try {
      console.log('setActiveHub called with hubId:', hubId);
      await axios.post('http://localhost:5000/api/set_active_hub', { hub_id: hubId });
      console.log('Active hub set on the backend for hubId:', hubId);
  } catch (err) {
      console.error('Error setting active hub:', err);
  }
};

const toggleDropdown = () => {
  setDropdownVisible(!dropdownVisible);
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
            <Dropdown show={dropdownVisible} onToggle={toggleDropdown} onSelect={handleHubSelect}>
              <Dropdown.Toggle variant="success" id="dropdown-basic">
                {activeHubName} {/* Display the active hub name in the navbar */}
              </Dropdown.Toggle>

              <Dropdown.Menu>
                {meetingHubs.length > 0 ? meetingHubs.map(hub => (
                  <Dropdown.Item key={hub?.id || `temp-${Date.now()}`} eventKey={hub?.id || null}>
                    {hub?.name || 'Unnamed Hub'}
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
              <AudioRecorder /> {/* Display AudioRecorder only if user is logged in */}
            </Col>
            <Col md={9} className="content">
              {isLoading ? (
                <Spinner animation="border" role="status">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
              ) : (
                <Routes>
                  <Route path="/" element={<DashboardPage selectedHub={selectedHub} />} />
                  <Route path="/meetings" element={<MeetingsPage />} />
                  <Route path="/action-items" element={<ActionItemsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              )}
              {error && <div className="error-message">{error}</div>}
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
            <Button variant="primary" onClick={handleCreateHub} disabled={isLoading}>
              {isLoading ? <Spinner animation="border" size="sm" /> : 'Create Hub'}
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