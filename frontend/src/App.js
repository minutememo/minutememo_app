import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, NavLink } from 'react-router-dom';
import { Container, Row, Col, Form, FormControl, Button, Navbar, Nav, Dropdown, Modal, Spinner } from 'react-bootstrap';
import { MdDashboard, MdEvent, MdList, MdSettings } from 'react-icons/md'; // Importing icons
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
import MeetingPage from './components/MeetingsPage'; // Adjust the path as necessary
import MeetingSessionPage from './components/MeetingSessionPage'; // Import the new component

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // Sidebar is collapsed by default

  // Environment variable for backend URL
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

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
        const response = await axios.get(`${backendUrl}/api/meetinghubs`);
        console.log('API response received:', response);

        if (response.status === 200) {
            const hubs = response.data.meeting_hubs || [];
            console.log('Fetched meeting hubs:', hubs);
            
            if (hubs.length > 0) {
                const activeHubId = parseInt(response.data.active_hub_id, 10) || hubs[0]?.id;
                console.log('Active Hub ID from API:', activeHubId);

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

  let tempIdCounter = -1;

  const handleCreateHub = async () => {
    if (!newHubName.trim()) {
      alert("Please enter a hub name.");
      return;
    }
  
    // Use a smaller negative integer as a temporary ID
    const tempHubId = tempIdCounter--;  // Decrement the counter for each new temporary ID
    const tempHub = { id: tempHubId, name: newHubName };
    setMeetingHubs(prevHubs => [...prevHubs, tempHub]);
    setSelectedHub(tempHub.id); // Temporarily select the new hub
    setActiveHubName(tempHub.name); // Update the active hub name with the temporary name
  
    try {
      setIsLoading(true);
      setError('');
  
      const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const response = await axios.post(`${baseURL}/api/meetinghubs`, { name: newHubName });
  
      if (response.status === 201 && response.data && response.data.meeting_hub_id) {
        const createdHubId = response.data.meeting_hub_id;
        const createdHub = { id: createdHubId, name: newHubName };
  
        // Replace the temporary hub with the actual hub returned by the server
        setMeetingHubs(prevHubs =>
          prevHubs.map(hub => hub.id === tempHubId ? createdHub : hub)
        );
        setSelectedHub(createdHub.id);
        setActiveHubName(createdHub.name);
  
        // Store the active hub in the database (if necessary)
        await setActiveHub(createdHub.id);
  
        // Trigger the data fetching manually after hub creation, only if you have a valid ID
        if (createdHubId > 0) {
          // fetchMeetingsAndSessions(createdHub.id); // Uncomment this if needed
        }
      } else {
        setError('Failed to create meeting hub');
        setMeetingHubs(prevHubs => prevHubs.filter(hub => hub.id !== tempHubId)); // Remove the temporary hub
        setActiveHubName('No Meeting Hub Selected');
      }
    } catch (err) {
      console.error('Error creating meeting hub:', err);
      setError('Error creating meeting hub');
      setMeetingHubs(prevHubs => prevHubs.filter(hub => hub.id !== tempHubId)); // Remove the temporary hub
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
        await axios.post(`${backendUrl}/api/set_active_hub`, { hub_id: hubId });
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
            <Navbar.Brand as={NavLink} to="/">
              <img src="/images/logo.svg" alt="Logo" style={{ height: '24px', marginRight: '10px' }} /> {/* Added logo */}
            </Navbar.Brand>
            <Form className="d-flex">
              <FormControl
                type="search"
                placeholder="Search"
                className="mr-2"
                aria-label="Search"
              />
              <Button variant="outline-success">Search</Button>
            </Form>

            {/* Customized Hub Selector */}
            <Dropdown show={dropdownVisible} onToggle={toggleDropdown} onSelect={handleHubSelect} className="hub-selector">
              <Dropdown.Toggle as="div" className="hub-dropdown">
                <span className="hub-name">{activeHubName}</span> 
                <span className="caret"></span>
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
                <NavLink to="/" className="nav-link">
                  <MdDashboard className="icon" />
                  <span className="link-text">Dashboard</span>
                </NavLink>
                <NavLink to="/meetings" className="nav-link">
                  <MdEvent className="icon" />
                  <span className="link-text">Meetings</span>
                </NavLink>
                <NavLink to="/action-items" className="nav-link">
                  <MdList className="icon" />
                  <span className="link-text">Action Items</span>
                </NavLink>
                <NavLink to="/settings" className="nav-link">
                  <MdSettings className="icon" />
                  <span className="link-text">Settings</span>
                </NavLink>
              </Nav>
              <UserEmailDisplay /> {/* Display the user email here if logged in */}
              <AudioRecorder selectedHub={selectedHub} setSelectedHub={setSelectedHub} /> {/* Display AudioRecorder */}
            </Col>
          </Row>

          {/* Move the .content Col out of the Row containing the sidebar */}
          <Row>
            <Col md={{ span: 9, offset: 3 }} className="content">
              {isLoading ? (
                <Spinner animation="border" role="status">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
              ) : (
                <Routes>
                  <Route path="/" element={<DashboardPage selectedHub={selectedHub} />} />
                  <Route path="/meetings/:meetingId" element={<MeetingsPage />} /> {/* Add this route */}
                  <Route path="/sessions/:sessionId" element={<MeetingSessionPage />} /> {/* Add this route */}
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