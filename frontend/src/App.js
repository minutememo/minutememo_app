// App.js

import React, { useState, useEffect, useCallback } from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
  NavLink,
  Navigate,
  useNavigate,
} from 'react-router-dom';
import {
  MdDashboard,
  MdEvent,
  MdList,
  MdSettings,
  MdPerson,
} from 'react-icons/md';
import { FaUserCircle } from 'react-icons/fa';
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
import FileUpload from './components/FileUpload';
import axios from 'axios';
import MeetingSessionPage from './components/MeetingSessionPage';
import SubscribePage from './components/SubscribePage';
import CalendarPage from './components/CalendarPage';
import EventDetailsPage from './components/EventDetailsPage';
import UserManagementPage from './components/UserManagementPage';
import GetStartedPage from './components/GetStartedPage';
import NotFoundPage from './components/NotFoundPage';
import {
  Container,
  Row,
  Col,
  FormControl,
  Button,
  Navbar,
  Nav,
  Dropdown,
  Modal,
  Spinner,
  Image,
  Alert,
} from 'react-bootstrap';

// Ensure Axios sends cookies with requests
axios.defaults.withCredentials = true;

// Helper function to extract the subdomain
const getSubdomain = () => {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  // Assuming 'companyname.minutememo.io'
  // Adjust the index based on your domain structure
  if (parts.length > 2) {
    return parts[0];
  }
  return null;
};

// Helper function to sanitize subdomain
const sanitizeSubdomain = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, ''); // Remove invalid characters
};

const AppContent = () => {
  const {
    user,
    loginUser,
    logoutUser,
    selectedHub,
    setSelectedHub,
    refreshToken,
    loading,
  } = useUser();
  
  const [meetingHubs, setMeetingHubs] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [activeHubName, setActiveHubName] = useState('Select Meeting Hub');
  const [showModal, setShowModal] = useState(false);
  const [newHubName, setNewHubName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [membershipError, setMembershipError] = useState('');
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [recurringEvents, setRecurringEvents] = useState([]);

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
  const navigate = useNavigate();

  // Extract subdomain
  const subdomain = getSubdomain();

  // New State Variables for Subdomain Handling
  const [companies, setCompanies] = useState([]);
  const [currentCompany, setCurrentCompany] = useState(null);
  const [companyLoading, setCompanyLoading] = useState(true);

  // Function to toggle dropdown visibility with logging
  const toggleDropdown = (isOpen, event, metadata) => {
    console.log(`[Dropdown] Visibility changed: ${isOpen}`);
    setDropdownVisible(isOpen);
  };

  // Function to handle hub selection with logging
  const handleHubSelect = (hubId) => {
    const selectedHubObj = meetingHubs.find((hub) => hub.id === hubId);
    if (selectedHubObj) {
      console.log(`[Hub Selection] Selected Hub: ${selectedHubObj.name} (ID: ${hubId})`);
      setSelectedHub(hubId);
      setActiveHubName(selectedHubObj.name);
    } else {
      console.warn(`[Hub Selection] Attempted to select a non-existent hub with ID: ${hubId}`);
    }
  };

  // Function to handle meeting selection with logging
  const handleMeetingSelect = (meetingId) => {
    setSelectedMeetingId(meetingId);
    console.log(`[Meeting Selection] Meeting selected: ID ${meetingId}`);
  };

  // Function to fetch meeting hubs with logging
  const fetchMeetingHubs = useCallback(async () => {
    console.log("[API] Fetching meeting hubs for user:", user);
    try {
      setIsLoading(true);
      const response = await axios.get(`${backendUrl}/api/meetinghubs`);
      if (response.status === 200) {
        const hubs = response.data.meeting_hubs || [];
        setMeetingHubs(hubs);
        console.log("[API] Fetched meeting hubs:", hubs);

        if (hubs.length > 0) {
          const activeHubId = parseInt(response.data.active_hub_id, 10) || null;
          const activeHub = hubs.find((hub) => hub.id === activeHubId);
          
          if (activeHub && activeHub.is_member) {
            setSelectedHub(activeHubId);
            setActiveHubName(activeHub.name);
            console.log(`[Hub Selection] Active hub set to: ${activeHub.name}`);
          } else {
            setSelectedHub(null);
            setActiveHubName('Select Meeting Hub');
            console.log("[Hub Selection] No active hub set. Please select a hub.");
          }
        } else {
          setSelectedHub(null);
          setActiveHubName('No Meeting Hub Selected');
          console.log("[Hub Selection] No meeting hubs available for the user.");
        }
      } else {
        setError('Failed to fetch meeting hubs');
        console.error(`[API] Failed to fetch meeting hubs. Status: ${response.status}`);
      }
    } catch (err) {
      console.error('[API] Error fetching meeting hubs:', err);
      setError('Error fetching meeting hubs');
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl, setSelectedHub, user]);

  // Function to fetch calendar events with logging
  const fetchCalendarEvents = useCallback(async () => {
    try {
      const today = new Date();
      const sixMonthsAhead = new Date();
      sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);

      console.log(`[API] Fetching events from ${today.toISOString()} to ${sixMonthsAhead.toISOString()}`);

      const response = await axios.get(`${backendUrl}/api/calendar/events`, {
        params: {
          start: today.toISOString(),
          end: sixMonthsAhead.toISOString(),
          singleEvents: false,
        },
      });

      if (response.status === 200) {
        const events = response.data;
        const eventsWithDateObjects = events.map((event) => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end),
        }));

        const recurring = eventsWithDateObjects.filter((event) => event.recurringEventId);

        const uniqueRecurringEvents = recurring.reduce((acc, event) => {
          if (!acc[event.recurringEventId]) {
            acc[event.recurringEventId] = event;
          }
          return acc;
        }, {});

        const recurringEventsArray = Object.values(uniqueRecurringEvents);

        const linkedEvents = await Promise.all(
          recurringEventsArray.map(async (event) => {
            try {
              const linkedResponse = await axios.get(`${backendUrl}/api/recurring-event/${event.recurringEventId}`);
              if (linkedResponse.status === 200) {
                console.log(`[API] Linked meeting found for recurring event ID ${event.recurringEventId}: ${linkedResponse.data.meeting_name}`);
                return { ...event, linkedMeeting: linkedResponse.data.meeting_name };
              } else {
                console.log(`[API] No linked meeting found for recurring event ID ${event.recurringEventId}`);
                return { ...event, linkedMeeting: null };
              }
            } catch (err) {
              console.error(`[API] Error fetching linked meeting for recurring event ID ${event.recurringEventId}:`, err);
              return { ...event, linkedMeeting: null };
            }
          })
        );

        setRecurringEvents(linkedEvents);
        console.log("[API] Fetched and processed calendar events:", linkedEvents);
      } else {
        setError('Failed to fetch calendar events');
        console.error(`[API] Failed to fetch calendar events. Status: ${response.status}`);
      }
    } catch (err) {
      console.error('[API] Error fetching calendar events:', err);
      setError('Error fetching calendar events');
    }
  }, [backendUrl]);

  // New Function to Fetch User's Companies
  const fetchCompanies = useCallback(async () => {
    try {
      setCompanyLoading(true);
      const response = await axios.get(`${backendUrl}/api/user/company`, {
        withCredentials: true,
      });
      if (response.status === 200) {
        setCompanies(response.data.companies);
        console.log("[API] Fetched companies:", response.data.companies);
      } else {
        setError('Failed to fetch companies.');
      }
    } catch (err) {
      console.error('[API] Error fetching companies:', err);
      setError('An error occurred while fetching companies.');
    } finally {
      setCompanyLoading(false);
    }
  }, [backendUrl]);

  // Validate subdomain against user's companies
  const validateSubdomain = useCallback(() => {
    if (subdomain) {
      console.log(`[validateSubdomain] Detected subdomain: ${subdomain}`);
      const matchedCompany = companies.find(
        (company) => sanitizeSubdomain(company.name) === subdomain
      );
      if (matchedCompany) {
        setCurrentCompany(matchedCompany);
        console.log(`[validateSubdomain] Current company set to: ${matchedCompany.name}`);
      } else {
        setError('Invalid workspace subdomain. Please select a valid workspace.');
        console.warn(`[validateSubdomain] No matching company found for subdomain: ${subdomain}`);
      }
    } else {
      // No subdomain; user needs to select a company
      setCurrentCompany(null);
      console.log("[validateSubdomain] No subdomain detected. User needs to select a workspace.");
    }
  }, [companies, subdomain]);

  // Effect to fetch data when user is authenticated
  useEffect(() => {
    console.log("[App] useEffect triggered: Checking user authentication status.");
    if (user) {
      console.log("[App] User is logged in:", user);
      fetchCompanies(); // New: Fetch companies
      fetchMeetingHubs();
      fetchCalendarEvents();
    } else {
      console.log("[App] User is not logged in. No data to fetch.");
      setCompanyLoading(false); // **Important Fix**
    }
  }, [user, fetchMeetingHubs, fetchCalendarEvents, fetchCompanies]);

  // Effect to validate subdomain once companies are fetched
  useEffect(() => {
    if (!companyLoading) {
      validateSubdomain();
    }
  }, [companyLoading, validateSubdomain]);

  // Axios Interceptor to handle 401 responses
  useEffect(() => {
    const axiosInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response && error.response.status === 401 && !originalRequest._retry) {
          console.warn('[Axios] Received 401 Unauthorized. Attempting to refresh token...');
          originalRequest._retry = true;
          const newUserData = await refreshToken();
          if (newUserData) {
            console.log("[Axios] Token refreshed successfully. Retrying original request.");
            // Assuming newUserData contains the updated access_token
            originalRequest.headers['Authorization'] = `Bearer ${newUserData.access_token}`;
            return axios(originalRequest);
          } else {
            console.log("[Axios] Token refresh failed. Logging out user.");
            await logoutUser(); // Clear user state and handle navigation
            // No need to manually redirect; logoutUser handles it
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(axiosInterceptor);
    };
  }, [refreshToken, logoutUser]);

  // Set or clear Authorization header based on user state
  useEffect(() => {
    if (user && user.access_token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${user.access_token}`;
      console.log("[Axios] Authorization header set with access token.");
    } else {
      delete axios.defaults.headers.common['Authorization'];
      console.log("[Axios] Authorization header removed.");
    }
  }, [user]);

  // Unified handleLogout function
  const handleLogout = async () => {
    console.log("[Logout] Initiating logout for user:", user);
    try {
      await logoutUser();
      console.log("[Logout] logoutUser() executed successfully.");
      // Clear Axios default Authorization header after logout
      delete axios.defaults.headers.common['Authorization'];
      console.log("[Axios] Authorization header removed after logout.");
      // Redirect to main domain after logout
      window.location.href = 'https://minutememo.io';
    } catch (err) {
      console.error("[Logout] Error during logout:", err);
      setError('Error during logout. Please try again.');
    }
  };

  // Function to handle hub creation with logging
  const handleCreateHub = async () => {
    if (!newHubName.trim()) {
      setError('Hub name cannot be empty.');
      console.warn("[Create Hub] Attempted to create a hub with an empty name.");
      return;
    }

    console.log(`[Create Hub] Creating new hub with name: ${newHubName}`);
    try {
      setIsLoading(true);
      const response = await axios.post(`${backendUrl}/api/meetinghubs`, { name: newHubName });

      if (response.status === 201) {
        const createdHub = response.data;
        setMeetingHubs([...meetingHubs, createdHub]);
        setSelectedHub(createdHub.id);
        setActiveHubName(createdHub.name);
        console.log(`[Create Hub] New hub created and selected:`, createdHub);
        setShowModal(false);
        setNewHubName('');
      } else {
        setError('Failed to create new hub.');
        console.error(`[Create Hub] Failed to create new hub. Status: ${response.status}`);
      }
    } catch (err) {
      console.error('[Create Hub] Error creating new hub:', err);
      setError('Error creating new hub.');
    } finally {
      setIsLoading(false);
    }
  };

  // Conditional Rendering based on authentication and workspace (subdomain) validation
  if (loading || companyLoading) {
    console.log("[App] Loading user data or company data...");
    // Show a loading spinner while checking user authentication and workspace
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  if (!user) {
    console.log("[App] User not logged in. Showing login/signup routes.");
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/subscribe" element={<SubscribePage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // If subdomain exists and there's an error, display the error
  if (subdomain && error) {
    console.log("[App] Invalid subdomain detected. Showing error.");
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <Alert variant="danger">
          {error}
        </Alert>
      </Container>
    );
  }

  // If no subdomain, render GetStartedPage for workspace selection
  if (!subdomain) {
    console.log("[App] No subdomain detected. Rendering GetStartedPage.");
    return (
      <Routes>
        <Route path="/start-here" element={<GetStartedPage />} />
        <Route path="*" element={<Navigate to="/start-here" replace />} />
      </Routes>
    );
  }

  // If subdomain is valid and user is associated with the company, render the main app
  return (
    <>
      <Navbar bg="dark" variant="dark" className="mb-4">
        <Container fluid>
          <Navbar.Brand as={NavLink} to="/dashboard">
            <img src="/images/logo.svg" alt="Logo" style={{ height: '24px', marginRight: '10px' }} />
          </Navbar.Brand>
          <FormControl type="search" placeholder="Search" className="me-2" aria-label="Search" />
          <Button variant="outline-success">Search</Button>

          <Dropdown show={dropdownVisible} onToggle={toggleDropdown} className="hub-selector me-auto">
            <Dropdown.Toggle as="div" className="hub-dropdown" style={{ cursor: 'pointer' }}>
              <span className="hub-name">{activeHubName}</span>
              <span className="caret"></span>
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {meetingHubs.length > 0 ? (
                meetingHubs.map((hub) => (
                  <Dropdown.Item
                    key={hub.id}
                    onClick={() => handleHubSelect(hub.id)}
                    active={selectedHub === hub.id}
                    className={!hub.is_member ? 'text-muted' : ''}
                  >
                    {hub.name || 'Unnamed Hub'}
                    {!hub.is_member && <span className="text-danger ms-2">(Not a Member)</span>}
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
              {user.avatar ? <Image src={user.avatar} roundedCircle height="30" width="30" alt="User Avatar" /> : <FaUserCircle size={30} />}
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
              <Dropdown.Item as="div" onClick={handleLogout}>
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
              <NavLink to="/dashboard" className="nav-link">
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
            <AudioRecorder selectedHub={selectedHub} selectedMeetingId={selectedMeetingId} />
            <FileUpload />
          </Col>

          <Col md={9} className="content">
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
                <Routes>
                  <Route path="/" element={<DashboardPage selectedHub={selectedHub} />} />
                  <Route path="/meetings" element={<MeetingsPage selectedHub={selectedHub} onMeetingSelect={handleMeetingSelect} />} />
                  <Route path="/sessions/:sessionId" element={<MeetingSessionPage selectedHub={selectedHub} />} />
                  <Route path="/action-items" element={<ActionItemsPage selectedHub={selectedHub} />} />
                  <Route path="/calendar" element={<CalendarPage events={calendarEvents} />} />
                  <Route path="/event/:eventId" element={<EventDetailsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/meetings/:meetingId" element={<MeetingsPage selectedHub={selectedHub} onMeetingSelect={handleMeetingSelect} />} />
                  <Route path="/user-management" element={<UserManagementPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </>
            )}
            {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
          </Col>
        </Row>
      </Container>

      <Modal show={showModal} onHide={() => { setShowModal(false); setError(''); setMembershipError(''); }}>
        <Modal.Header closeButton>
          <Modal.Title>Create New Meeting Hub</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <FormControl
            type="text"
            placeholder="Enter hub name"
            value={newHubName}
            onChange={(e) => setNewHubName(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter') handleCreateHub(); }}
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
  );
};

const App = () => (
  <Router>
    <UserProvider>
      <RecorderProvider>
        <AppContent />
      </RecorderProvider>
    </UserProvider>
  </Router>
);

export default App;