import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, NavLink } from 'react-router-dom';
import { MdDashboard, MdEvent, MdList, MdSettings, MdPerson } from 'react-icons/md'; // Importing icons
import { FaUserCircle } from 'react-icons/fa'; // User icon
import './styles.css'; // Import styles
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
import FileUpload from './components/FileUpload'; // Import FileUpload component
import axios from 'axios';
import MeetingSessionPage from './components/MeetingSessionPage'; // Import the new component
import SubscribePage from './components/SubscribePage'; // Create this component
import CalendarPage from './components/CalendarPage'; // New CalendarPage Component for calendar events
import EventDetailsPage from './components/EventDetailsPage'; // Import EventDetailsPage
import UserManagementPage from './components/UserManagementPage'; // New UserManagementPage Component
import { Container, Row, Col, FormControl, Button, Navbar, Nav, Dropdown, Modal, Spinner, Image, Alert } from 'react-bootstrap';

axios.defaults.withCredentials = true; // Ensure cookies are sent with every request

const AppContent = () => {
  const { user, loginUser, logoutUser } = useUser(); // Get user from the context
  const [meetingHubs, setMeetingHubs] = useState([]);
  const [selectedHub, setSelectedHub] = useState(null);
  const [selectedMeetingId, setSelectedMeetingId] = useState(null); // Add state for selected meeting
  const [activeHubName, setActiveHubName] = useState('Select Meeting Hub');
  const [showModal, setShowModal] = useState(false);
  const [newHubName, setNewHubName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // Sidebar is collapsed by default
  const [recurringEvents, setRecurringEvents] = useState([]); // Add this for recurring events state
  const [calendarEvents, setCalendarEvents] = useState([]); // Add this for calendar events state
  const [membershipError, setMembershipError] = useState(''); // State for membership errors

  // Environment variable for backend URL
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Function to refresh the token
  const refreshToken = async () => {
    try {
      const response = await axios.post(`${backendUrl}/auth/refresh`, {}, { withCredentials: true });
      if (response.status === 200) {
        const newUserData = response.data.user;
        loginUser(newUserData); // Update the user data with the new token
        return newUserData; // Return the new user data to retry the failed request
      }
    } catch (err) {
      console.error('Failed to refresh token:', err);
      logoutUser(); // Log out the user if refresh fails
    }
  };

  useEffect(() => {
    // Add Axios interceptor to check for token expiration on each request
    const axiosInterceptor = axios.interceptors.response.use(
      (response) => response, // Return the response if no errors
      async (error) => {
        const originalRequest = error.config;

        if (error.response && error.response.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true; // Set a flag to avoid infinite retry loop

          // Attempt to refresh the token
          const newUserData = await refreshToken();
          if (newUserData) {
            // Update the Authorization header with the new token
            originalRequest.headers['Authorization'] = `Bearer ${newUserData.token}`;
            return axios(originalRequest); // Retry the failed request
          }
        }

        return Promise.reject(error); // Reject the error if it can't be handled
      }
    );

    return () => {
      axios.interceptors.response.eject(axiosInterceptor); // Clean up the interceptor when the component unmounts
    };
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchMeetingHubs();
      fetchCalendarEvents(); // Fetch calendar events after login
    }
  }, [user]);

  // Fetch all meeting hubs for the user's company, including membership status
  const fetchMeetingHubs = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${backendUrl}/api/meetinghubs`);
      if (response.status === 200) {
        const hubs = response.data.meeting_hubs || [];
        setMeetingHubs(hubs);

        if (hubs.length > 0) {
          // Determine the active hub
          const activeHubId = parseInt(response.data.active_hub_id, 10) || null;

          if (activeHubId) {
            const activeHub = hubs.find(hub => hub.id === activeHubId);
            if (activeHub && activeHub.is_member) {
              setSelectedHub(activeHubId);
              setActiveHubName(activeHub.name);
            } else {
              setSelectedHub(null);
              setActiveHubName('Select Meeting Hub');
            }
          } else {
            setSelectedHub(null);
            setActiveHubName('Select Meeting Hub');
          }
        } else {
          setSelectedHub(null);
          setActiveHubName('No Meeting Hub Selected');
        }
      } else {
        setError('Failed to fetch meeting hubs');
      }
    } catch (err) {
      console.error('Error fetching meeting hubs:', err);
      setError('Error fetching meeting hubs');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch calendar events (unchanged)
  const fetchCalendarEvents = async () => {
    try {
      const today = new Date(); // Get today's date
      const sixMonthsAhead = new Date(); // Calculate 6 months ahead
      sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);

      console.log(`Fetching events starting from ${today.toISOString()} to ${sixMonthsAhead.toISOString()}`);

      const response = await axios.get(`${backendUrl}/api/calendar/events`, {
        params: {
          start: today.toISOString(),
          end: sixMonthsAhead.toISOString(),
          singleEvents: false,
        },
      });

      if (response.status === 200) {
        console.log('Calendar events fetched successfully.');
        const events = response.data;

        // Convert event start and end to Date objects
        const eventsWithDateObjects = events.map(event => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end),
        }));

        const recurring = eventsWithDateObjects.filter(event => event.recurringEventId);

        if (recurring.length === 0) {
          console.log('No recurring events found');
        } else {
          console.log(`Found ${recurring.length} recurring events.`);
        }

        const uniqueRecurringEvents = recurring.reduce((acc, event) => {
          if (!acc[event.recurringEventId]) {
            acc[event.recurringEventId] = event;
          }
          return acc;
        }, {});

        const recurringEventsArray = Object.values(uniqueRecurringEvents);
        console.log(`Unique recurring events count: ${recurringEventsArray.length}`);

        const linkedEvents = await Promise.all(
          recurringEventsArray.map(async (event, index) => {
            console.log(`Fetching linked meeting for recurring event ${index + 1}`);
            try {
              const linkedResponse = await axios.get(`${backendUrl}/api/recurring-event/${event.recurringEventId}`);
              if (linkedResponse.status === 200) {
                return { ...event, linkedMeeting: linkedResponse.data.meeting_name };
              } else {
                return { ...event, linkedMeeting: null };
              }
            } catch (err) {
              return { ...event, linkedMeeting: null };
            }
          })
        );

        setRecurringEvents(linkedEvents);  // Set the state for recurring events
      } else {
        setError('Failed to fetch calendar events');
      }
    } catch (err) {
      console.error('Error fetching calendar events:', err);
      setError('Error fetching calendar events');
    }
  };

  // Update the active hub name based on the selected hub
  const updateActiveHubName = (hubId, hubs = meetingHubs) => {
    const hub = hubs.find(hub => hub.id === parseInt(hubId, 10));
    if (hub) {
      setActiveHubName(hub.name);
    } else {
      setActiveHubName('No Meeting Hub Selected');
    }
  };

  // Handle hub creation
  const handleCreateHub = async () => {
    if (!newHubName.trim()) {
      alert('Please enter a hub name.');
      return;
    }

    try {
      setIsLoading(true);
      const response = await axios.post(`${backendUrl}/api/meetinghubs`, { name: newHubName });
      if (response.status === 201 && response.data.meeting_hub_id) {
        const newHubId = response.data.meeting_hub_id;

        // Set the new hub as the active hub
        await setActiveHub(newHubId);

        // Refresh the meeting hubs to include the new hub
        await fetchMeetingHubs();

        setNewHubName(''); // Clear the input
        setShowModal(false); // Close the modal
        setError(''); // Clear any previous errors
        setMembershipError(''); // Clear any membership errors
      } else {
        setError('Failed to create meeting hub');
      }
    } catch (err) {
      console.error('Error creating meeting hub:', err);
      setError('Error creating meeting hub');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle hub selection with membership check
  const handleHubSelect = async hubId => {
    const hub = meetingHubs.find(h => h.id === hubId);
    if (!hub) {
      setError('Selected hub does not exist.');
      return;
    }

    if (hub.is_member) {
      try {
        setIsLoading(true);
        await setActiveHub(hubId);
        setSelectedHub(hubId);
        updateActiveHubName(hubId);
        setDropdownVisible(false);
        setError(''); // Clear any previous errors
        setMembershipError(''); // Clear any membership errors
      } catch (err) {
        console.error('Error selecting hub:', err);
        setError('Error selecting hub');
      } finally {
        setIsLoading(false);
      }
    } else {
      // User is not a member of the selected hub
      setMembershipError('You are not a member of this hub. Please select a hub where you are a member.');
    }
  };

  // Set the active hub by making an API call
  const setActiveHub = async hubId => {
    try {
      await axios.post(`${backendUrl}/api/set_active_hub`, { hub_id: hubId });
      // Update the active hub name after successful setting
      updateActiveHubName(hubId);
    } catch (err) {
      console.error('Error setting active hub:', err);
      setError('Error setting active hub');
      throw err; // Re-throw to handle in the caller if needed
    }
  };

  const toggleDropdown = () => {
    setDropdownVisible(!dropdownVisible);
  };

  const handleMeetingSelect = (meetingId) => {
    setSelectedMeetingId(meetingId); // Store the selected meeting ID
  };

  return (
    <Router>
      {user ? (
        <>
          <Navbar bg="dark" variant="dark" className="mb-4">
            <Container fluid>
              <Navbar.Brand as={NavLink} to="/">
                <img src="/images/logo.svg" alt="Logo" style={{ height: '24px', marginRight: '10px' }} />
              </Navbar.Brand>
              <FormControl
                type="search"
                placeholder="Search"
                className="me-2"
                aria-label="Search"
              />
              <Button variant="outline-success">Search</Button>

              <Dropdown
                show={dropdownVisible}
                onToggle={toggleDropdown}
                className="hub-selector me-auto"
              >
                <Dropdown.Toggle as="div" className="hub-dropdown" style={{ cursor: 'pointer' }}>
                  <span className="hub-name">{activeHubName}</span>
                  <span className="caret"></span>
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {meetingHubs.length > 0 ? (
                    meetingHubs.map(hub => (
                      <Dropdown.Item
                        key={hub.id}
                        onClick={() => handleHubSelect(hub.id)}
                        active={selectedHub === hub.id}
                        className={!hub.is_member ? 'text-muted' : ''}
                      >
                        {hub.name || 'Unnamed Hub'}
                        {!hub.is_member && (
                          <span className="text-danger ms-2">(Not a Member)</span>
                        )}
                      </Dropdown.Item>
                    ))
                  ) : (
                    <Dropdown.Item disabled>No hubs available</Dropdown.Item>
                  )}
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={() => { setShowModal(true); setMembershipError(''); }}>
                    Create New Hub
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>

              <Dropdown align="end">
                <Dropdown.Toggle variant="secondary" id="dropdown-basic">
                  {user.avatar ? (
                    <Image src={user.avatar} roundedCircle height="30" width="30" alt="User Avatar" />
                  ) : (
                    <FaUserCircle size={30} />
                  )}
                  <span className="ms-2">{user.first_name} {user.last_name}</span>
                </Dropdown.Toggle>

                <Dropdown.Menu>
                  <Dropdown.Item as={NavLink} to="/settings">
                    <MdSettings className="me-2" />
                    Settings
                  </Dropdown.Item>
                  <Dropdown.Item as={NavLink} to="/user-management">
                    <MdPerson className="me-2" />
                    User Management
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item as="div">
                    <LogoutButton />
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
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
                  <NavLink to="/calendar" className="nav-link">
                    <MdEvent className="icon" />
                    <span className="link-text">Calendar</span>
                  </NavLink>
                </Nav>
                <UserEmailDisplay />
                <AudioRecorder
                  selectedHub={selectedHub}
                  selectedMeetingId={selectedMeetingId}
                />
                <FileUpload />
              </Col>
            </Row>

            <Row>
              <Col md={{ span: 9, offset: 3 }} className="content">
                {isLoading ? (
                  <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
                    <Spinner animation="border" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </Spinner>
                  </div>
                ) : (
                  <>
                    {membershipError && (
                      <Alert variant="warning" onClose={() => setMembershipError('')} dismissible>
                        {membershipError}
                      </Alert>
                    )}
                    {selectedHub ? (
                      <Routes>
                        <Route path="/" element={<DashboardPage selectedHub={selectedHub} />} />
                        <Route
                          path="/meetings"
                          element={<MeetingsPage selectedHub={selectedHub} onMeetingSelect={handleMeetingSelect} />}
                        />
                        <Route path="/sessions/:sessionId" element={<MeetingSessionPage selectedHub={selectedHub} />} />
                        <Route path="/action-items" element={<ActionItemsPage selectedHub={selectedHub} />} />
                        <Route path="/calendar" element={<CalendarPage events={calendarEvents} />} />
                        <Route path="/event/:eventId" element={<EventDetailsPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/meetings/:meetingId" element={<MeetingsPage />} />
                        <Route path="/user-management" element={<UserManagementPage />} />
                      </Routes>
                    ) : (
                      <Alert variant="info" className="text-center">
                        You are not a member of any hub. Please create a new hub or join an existing one.
                      </Alert>
                    )}
                  </>
                )}
                {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
              </Col>
            </Row>
          </Container>

          {/* Modal for Creating New Hub */}
          <Modal show={showModal} onHide={() => { setShowModal(false); setError(''); setMembershipError(''); }}>
            <Modal.Header closeButton>
              <Modal.Title>Create New Meeting Hub</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <FormControl
                type="text"
                placeholder="Enter hub name"
                value={newHubName}
                onChange={e => setNewHubName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateHub();
                  }
                }}
              />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => { setShowModal(false); setError(''); setMembershipError(''); }}>
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
          <Route path="/subscribe" element={<SubscribePage />} />
          <Route path="/" element={<DashboardPage />} />
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