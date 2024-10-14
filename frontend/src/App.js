// App.js
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
import { Container, Row, Col, Form, FormControl, Button, Navbar, Nav, Dropdown, Modal, Spinner, Image } from 'react-bootstrap';


axios.defaults.withCredentials = true; // Ensure cookies are sent with every request

const AppContent = () => {
  const { user } = useUser(); // Get user from the context
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

  // Environment variable for backend URL
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  useEffect(() => {
    if (user) {
      fetchMeetingHubs();
      fetchCalendarEvents(); // Fetch calendar events after login
    }
  }, [user]);

  const fetchMeetingHubs = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${backendUrl}/api/meetinghubs`);
      if (response.status === 200) {
        const hubs = response.data.meeting_hubs || [];
        if (hubs.length > 0) {
          const activeHubId = parseInt(response.data.active_hub_id, 10) || hubs[0]?.id;
          setMeetingHubs(hubs);
          setSelectedHub(activeHubId);
          updateActiveHubName(activeHubId, hubs);
        } else {
          setSelectedHub(null);
          setActiveHubName('No Meeting Hub Selected');
        }
      } else {
        setError('Failed to fetch meeting hubs');
      }
    } catch (err) {
      setError('Error fetching meeting hubs');
    } finally {
      setIsLoading(false);
    }
  };

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
      setError('Error fetching calendar events');
    }
  };

  const updateActiveHubName = (hubId, hubs = meetingHubs) => {
    const hub = hubs.find(hub => hub.id === parseInt(hubId, 10));
    if (hub) {
      setActiveHubName(hub.name);
    } else {
      setActiveHubName('No Meeting Hub Selected');
    }
  };

  const handleCreateHub = async () => {
    if (!newHubName.trim()) {
      alert('Please enter a hub name.');
      return;
    }

    const tempHubId = -1; // Temporary ID for the hub
    const tempHub = { id: tempHubId, name: newHubName };
    setMeetingHubs(prevHubs => [...prevHubs, tempHub]);
    setSelectedHub(tempHub.id);
    setActiveHubName(tempHub.name);

    try {
      setIsLoading(true);
      const response = await axios.post(`${backendUrl}/api/meetinghubs`, { name: newHubName });
      if (response.status === 201 && response.data.meeting_hub_id) {
        const createdHubId = response.data.meeting_hub_id;
        const createdHub = { id: createdHubId, name: newHubName };
        setMeetingHubs(prevHubs =>
          prevHubs.map(hub => (hub.id === tempHubId ? createdHub : hub))
        );
        setSelectedHub(createdHub.id);
        setActiveHubName(createdHub.name);
        await setActiveHub(createdHub.id);
        await fetchMeetingHubs();
      } else {
        setError('Failed to create meeting hub');
      }
    } catch (err) {
      setError('Error creating meeting hub');
    } finally {
      setIsLoading(false);
      setNewHubName('');
      setShowModal(false);
    }
  };

  const handleHubSelect = async hubId => {
    try {
      await setActiveHub(hubId);
      setSelectedHub(hubId);
      updateActiveHubName(hubId);
      setDropdownVisible(false);
    } catch (err) {
      setError('Error selecting hub');
    }
  };

  const setActiveHub = async hubId => {
    try {
      await axios.post(`${backendUrl}/api/set_active_hub`, { hub_id: hubId });
    } catch (err) {
      setError('Error setting active hub');
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
              <Form className="d-flex">
                <FormControl
                  type="search"
                  placeholder="Search"
                  className="mr-2"
                  aria-label="Search"
                />
                <Button variant="outline-success">Search</Button>
              </Form>

              <Dropdown
                show={dropdownVisible}
                onToggle={toggleDropdown}
                onSelect={handleHubSelect}
                className="hub-selector me-auto"
              >
                <Dropdown.Toggle as="div" className="hub-dropdown">
                  <span className="hub-name">{activeHubName}</span>
                  <span className="caret"></span>
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {meetingHubs.length > 0 ? (
                    meetingHubs.map(hub => (
                      <Dropdown.Item key={hub.id || `temp-${Date.now()}`} eventKey={hub.id}>
                        {hub.name || 'Unnamed Hub'}
                      </Dropdown.Item>
                    ))
                  ) : (
                    <Dropdown.Item disabled>No hubs available</Dropdown.Item>
                  )}
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={() => setShowModal(true)}>Create New Hub</Dropdown.Item>
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
                  <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </Spinner>
                ) : (
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
                )}
                {error && <div className="error-message">{error}</div>}
              </Col>
            </Row>
          </Container>

          <Modal show={showModal} onHide={() => setShowModal(false)}>
            <Modal.Header closeButton>
              <Modal.Title>Create New Meeting Hub</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <FormControl
                type="text"
                placeholder="Enter hub name"
                value={newHubName}
                onChange={e => setNewHubName(e.target.value)}
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