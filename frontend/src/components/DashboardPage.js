import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext';
import { Container, Table, Button, Spinner, Modal, Form, Alert } from 'react-bootstrap';
import '../styles.css';

const DashboardPage = ({ selectedHub }) => {
  const { user } = useUser(); // Get the user context
  console.log('User from context:', user); // Log the user object

  const [meetings, setMeetings] = useState([]);
  const [meetingSessions, setMeetingSessions] = useState([]);
  const [recurringEvents, setRecurringEvents] = useState([]);
  const [usersInHub, setUsersInHub] = useState([]);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [error, setError] = useState('');
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [subscriptionEmpty, setSubscriptionEmpty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newMeetingName, setNewMeetingName] = useState('');
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [showAddUsersModal, setShowAddUsersModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showLinkMeetingModal, setShowLinkMeetingModal] = useState(false);
  const [linkingRecurringEventId, setLinkingRecurringEventId] = useState(null);
  const [newLinkedMeetingName, setNewLinkedMeetingName] = useState('');
  const [isLinkingMeeting, setIsLinkingMeeting] = useState(false);
  const [membershipError, setMembershipError] = useState('');
  const [linkError, setLinkError] = useState('');
  const navigate = useNavigate();
  const eventsFetched = useRef(false);
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  // Fetch subscription status
  useEffect(() => {
    if (user) {
      const checkSubscriptionStatus = async () => {
        try {
          setIsLoading(true);
          console.log('Checking subscription status...');
          const response = await axios.get(`${backendUrl}/api/subscription-status`, { withCredentials: true });
          if (response.status === 200) {
            if (response.data.is_active) {
              console.log("Subscription is active");
              setSubscriptionActive(true);
            } else if (response.data.is_empty) {
              console.log("No subscription found");
              setSubscriptionEmpty(true);
            } else {
              console.log("Subscription is inactive");
              setSubscriptionActive(false);
              navigate('/subscribe');
            }
          } else {
            setError('Failed to fetch subscription status');
            console.error('Failed to fetch subscription status');
          }
        } catch (err) {
          console.error('Error checking subscription status:', err);
          setError('Error checking subscription status');
        } finally {
          setIsLoading(false);
        }
      };
      checkSubscriptionStatus();
    } else {
      console.log('User is not logged in.');
      setIsLoading(false);
    }
  }, [user, backendUrl, navigate]);

  // Fetch recurring calendar events starting from today
  const fetchCalendarEvents = async () => {
    if (eventsFetched.current) return; // Ensure events are only fetched once
    try {
      const today = new Date();
      const sixMonthsAhead = new Date();
      sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);

      console.log(`Fetching events starting from ${today.toISOString()} to ${sixMonthsAhead.toISOString()}`);

      const response = await axios.get(`${backendUrl}/api/calendar/events`, {
        params: {
          start: today.toISOString(),
          end: sixMonthsAhead.toISOString(),
          singleEvents: false,
        },
        withCredentials: true, // Ensure cookies are sent
      });

      if (response.status === 200) {
        console.log('Calendar events fetched successfully.');
        const events = response.data;

        const eventsWithDateObjects = events.map(event => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end),
        }));

        const recurring = eventsWithDateObjects.filter(event => event.recurringEventId);
        console.log(`Found ${recurring.length} recurring events.`);

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
            console.log(`Fetching linked meeting for recurring event ${index + 1} with ID: ${event.recurringEventId}`);
            try {
              const linkedResponse = await axios.get(`${backendUrl}/api/recurring-event/${event.recurringEventId}`, {
                withCredentials: true,
              });
              if (linkedResponse.status === 200) {
                console.log(`Linked meeting found for event ${index + 1}: ${linkedResponse.data.meeting_name}`);
                return { 
                  ...event, 
                  linkedMeeting: linkedResponse.data.meeting_name, 
                  meeting_id: linkedResponse.data.meeting_id 
                };
              } else {
                console.log(`No linked meeting found for event ${index + 1}`);
                return { ...event, linkedMeeting: null, meeting_id: null };
              }
            } catch (err) {
              console.error(`Error fetching linked meeting for event ${index + 1}:`, err);
              return { ...event, linkedMeeting: null, meeting_id: null };
            }
          })
        );

        setRecurringEvents(linkedEvents);
        eventsFetched.current = true;
      } else {
        console.error('Failed to fetch calendar events. Response status:', response.status);
        setError('Failed to fetch calendar events');
      }
    } catch (err) {
      console.error('Error fetching calendar events:', err);
      setError('Error fetching calendar events');
    }
  };

  // Fetch users in the selected hub
  const fetchUsersInHub = async () => {
    try {
      console.log('Fetching users linked to the hub...');
      const response = await axios.get(`${backendUrl}/api/meetinghubs/${selectedHub}/users`, { withCredentials: true });
      if (response.status === 200) {
        setUsersInHub(response.data.users);
      } else {
        setError('Failed to fetch users in the hub');
      }
    } catch (err) {
      console.error('Error fetching users in the hub:', err);
      setError('Error fetching users in the hub');
    }
  };

  // Fetch users from the company
  const fetchUsersFromCompany = async () => {
    try {
      console.log('Fetching users from company...');
      const response = await axios.get(`${backendUrl}/api/users`, { withCredentials: true });
      if (response.status === 200) {
        setCompanyUsers(response.data.users);
      } else {
        setError('Failed to fetch users from company');
      }
    } catch (err) {
      console.error('Error fetching users from company:', err);
      setError('Error fetching users from company');
    }
  };

  // Fetch meetings and meeting sessions
  useEffect(() => {
    if (selectedHub && subscriptionActive) {
      console.log("Subscription active and hub selected, fetching data...");

      const fetchMeetings = async () => {
        try {
          console.log('Fetching meetings...');
          const response = await axios.get(`${backendUrl}/api/meetings?hub_id=${selectedHub}`, { withCredentials: true });
          if (response.status === 200) {
            setMeetings(response.data.meetings);
          } else {
            setError('Failed to fetch meetings');
          }
        } catch (err) {
          console.error('Error fetching meetings:', err);
          setError('Error fetching meetings');
        }
      };

      const fetchMeetingSessions = async () => {
        try {
          console.log('Fetching meeting sessions...');
          const response = await axios.get(`${backendUrl}/api/meetingsessions?hub_id=${selectedHub}`, { withCredentials: true });
          if (response.status === 200) {
            setMeetingSessions(response.data.meeting_sessions);
          } else {
            setError('Failed to fetch meeting sessions');
          }
        } catch (err) {
          console.error('Error fetching meeting sessions:', err);
          setError('Error fetching meeting sessions');
        }
      };

      fetchMeetings();
      fetchMeetingSessions();
      fetchCalendarEvents();
      fetchUsersInHub(); // Fetch users in the hub
    } else {
      console.log('Selected Hub or Subscription not active. Skipping fetch.');
    }
  }, [selectedHub, backendUrl, subscriptionActive]);

  // Create new meeting
  const handleCreateMeeting = async () => {
    if (!newMeetingName || !selectedHub) {
      setError('Please provide a meeting name and select a hub.');
      return;
    }

    setIsCreatingMeeting(true);

    try {
      const response = await axios.post(`${backendUrl}/api/meetings`, {
        name: newMeetingName,
        hub_id: selectedHub,
      }, { withCredentials: true });
      if (response.status === 201) {
        setMeetings((prevMeetings) => [...prevMeetings, { id: response.data.meeting_id, name: newMeetingName }]);
        setNewMeetingName(''); // Clear the input after successful creation
      } else {
        setError('Failed to create a new meeting');
      }
    } catch (err) {
      console.error('Error creating a new meeting:', err);
      setError('Error creating a new meeting');
    } finally {
      setIsCreatingMeeting(false);
    }
  };

  // Link meeting to recurring event
  const handleLinkMeeting = (recurringEventId) => {
    setLinkingRecurringEventId(recurringEventId);
    setNewLinkedMeetingName('');
    setShowLinkMeetingModal(true);
    setLinkError('');
  };

  const submitLinkMeeting = async () => {
    if (!newLinkedMeetingName.trim()) {
      setLinkError('Meeting name cannot be empty.');
      return;
    }

    try {
      setIsLinkingMeeting(true);
      const response = await axios.post(`${backendUrl}/api/recurring-event/${linkingRecurringEventId}/link`, {
        meeting_name: newLinkedMeetingName.trim(),
      }, { withCredentials: true });

      if (response.status === 201 || response.status === 200) {
        alert(response.data.message);
        setShowLinkMeetingModal(false);
        setLinkError('');
        fetchCalendarEvents(); // Refresh the recurring events list
        // Optionally, fetch meetings and meeting sessions again
        // fetchMeetings();
        // fetchMeetingSessions();
      } else {
        setLinkError(response.data.message || 'Failed to link meeting.');
      }
    } catch (err) {
      console.error('Error linking meeting to recurring event:', err);
      setLinkError(err.response?.data?.message || 'Error linking meeting to recurring event.');
    } finally {
      setIsLinkingMeeting(false);
    }
  };

  // Open the modal to add users to the hub
  const openAddUsersModal = async () => {
    setSelectedUsers([]); // Reset selected users
    await fetchUsersFromCompany(); // Fetch users from the company
    await fetchUsersInHub(); // Ensure users in hub are fetched before showing the modal
    console.log('Opening Add Users Modal'); // Log for debugging
    setShowAddUsersModal(true); // Show the modal
    setError('');
  };

  // Close the modal
  const closeAddUsersModal = () => {
    setShowAddUsersModal(false);
  };

  // Handle selecting or unselecting users
  const handleUserSelection = (userId) => {
    setSelectedUsers((prevSelectedUsers) => {
      if (prevSelectedUsers.includes(userId)) {
        return prevSelectedUsers.filter((id) => id !== userId);
      } else {
        return [...prevSelectedUsers, userId];
      }
    });
  };

  // Handle adding selected users to the hub
  const handleAddUsersToHub = async () => {
    if (selectedUsers.length === 0) {
      setError('Please select at least one user.');
      return;
    }

    try {
      setIsLoading(true);
      const response = await axios.post(`${backendUrl}/api/meetinghubs/${selectedHub}/add-users`, {
        user_ids: selectedUsers,
      }, { withCredentials: true });

      if (response.status === 200) {
        alert('Users added to the hub successfully.');
        setShowAddUsersModal(false);
        setSelectedUsers([]);
        fetchUsersInHub(); // Refresh the users in the hub
        setError('');
      } else {
        setError(response.data.message || 'Failed to add users to the hub.');
      }
    } catch (err) {
      console.error('Error adding users to the hub:', err);
      setError(err.response?.data?.message || 'Error adding users to the hub.');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter out users already linked to the hub from companyUsers
  const filteredCompanyUsers = companyUsers.filter((companyUser) =>
    !usersInHub.some((hubUser) => hubUser.id === companyUser.id)
  );

  // Loading states and subscription handling
  if (!user) {
    return <p>Please log in to access your dashboard.</p>;
  }

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (subscriptionEmpty) {
    return (
      <div className="dashboard">
        <Container>
          <Alert variant="warning">
            <h4>No Subscription Found</h4>
            <p>
              Please <Link to="/subscribe">subscribe</Link> to access your dashboard.
            </p>
          </Alert>
        </Container>
      </div>
    );
  }

  if (!subscriptionActive) {
    return (
      <div className="dashboard">
        <Container>
          <Alert variant="danger">
            <h4>Subscription Inactive</h4>
            <p>
              Your subscription is inactive. Please <Link to="/subscribe">subscribe</Link> to continue.
            </p>
          </Alert>
        </Container>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <Container>
        {/* Create New Meeting Section */}
        <div className="box-shadow-container mb-4 p-3">
          <h3>Create a New Meeting</h3>
          <div className="d-flex">
            <Form.Control
              type="text"
              placeholder="Enter meeting name"
              value={newMeetingName}
              onChange={(e) => setNewMeetingName(e.target.value)}
              className="me-2"
            />
            <Button onClick={handleCreateMeeting} disabled={isCreatingMeeting}>
              {isCreatingMeeting ? <Spinner animation="border" size="sm" /> : 'Create Meeting'}
            </Button>
          </div>
          {error && <Alert variant="danger" className="mt-2">{error}</Alert>}
        </div>

        {/* Meetings List */}
        <div className="box-shadow-container mb-4 p-3">
          <h3>Meetings</h3>
          {error && <Alert variant="danger">{error}</Alert>}
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Meeting Name</th>
                <th>Description</th>
                <th>Is Recurring</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((meeting) => (
                <tr key={meeting.id}>
                  <td>
                    <Link to={`/meetings/${meeting.id}`}>{meeting.name}</Link>
                  </td>
                  <td>{meeting.description}</td>
                  <td>{meeting.is_recurring ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        {/* Recurring Calendar Events */}
        <div className="box-shadow-container mb-4 p-3">
          <h3>Recurring Calendar Events</h3>
          {recurringEvents.length === 0 ? (
            <p>No recurring events found.</p>
          ) : (
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Event Name</th>
                  <th>Linked Meeting</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recurringEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{event.summary}</td>
                    <td>
                      {event.linkedMeeting ? (
                        <Link to={`/meetings/${event.meeting_id}`}>{event.linkedMeeting}</Link>
                      ) : (
                        'Not linked'
                      )}
                    </td>
                    <td>
                      {event.linkedMeeting ? (
                        <Button variant="success" size="sm" disabled>
                          Linked
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleLinkMeeting(event.recurringEventId)}
                        >
                          Link
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        {/* Users Linked to the Hub */}
        <div className="box-shadow-container mb-4 p-3">
          <h3>Users Linked to the Hub</h3>
          <Button variant="primary" onClick={openAddUsersModal} className="mb-3">
            Add Users to Hub
          </Button>
          {usersInHub.length === 0 ? (
            <p>No users linked to the hub.</p>
          ) : (
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {usersInHub.map((hubUser) => (
                  <tr key={hubUser.id}>
                    <td>{`${hubUser.first_name} ${hubUser.last_name}`}</td>
                    <td>{hubUser.email}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        {/* Meeting Sessions */}
        <div className="box-shadow-container p-3">
          <h3>Meeting Sessions</h3>
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Session Name</th>
                <th>Meeting Name</th>
                <th>Date and Time</th>
              </tr>
            </thead>
            <tbody>
              {meetingSessions.map((session) => (
                <tr key={session.id}>
                  <td>{session.name}</td>
                  <td>{session.meeting_name}</td>
                  <td>{new Date(session.session_datetime).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Container>

      {/* Modal for Adding Users to Hub */}
      <Modal show={showAddUsersModal} onHide={closeAddUsersModal}>
        <Modal.Header closeButton>
          <Modal.Title>Add Users to Hub</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {filteredCompanyUsers.length === 0 ? (
            <p>No available users to add.</p> // Show message if no users are available
          ) : (
            <Form>
              {filteredCompanyUsers.map((companyUser) => (
                <Form.Check
                  key={companyUser.id}
                  type="checkbox"
                  label={`${companyUser.first_name} ${companyUser.last_name} (${companyUser.email})`}
                  checked={selectedUsers.includes(companyUser.id)}
                  onChange={() => handleUserSelection(companyUser.id)}
                />
              ))}
            </Form>
          )}
          {error && <Alert variant="danger" className="mt-2">{error}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeAddUsersModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAddUsersToHub} disabled={isLoading}>
            {isLoading ? <Spinner animation="border" size="sm" /> : 'Add Users'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal for Linking Meeting to Recurring Event */}
      <Modal show={showLinkMeetingModal} onHide={() => setShowLinkMeetingModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Link Recurring Event to Meeting</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group controlId="meetingName">
              <Form.Label>Meeting Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter meeting name"
                value={newLinkedMeetingName}
                onChange={(e) => setNewLinkedMeetingName(e.target.value)}
              />
            </Form.Group>
          </Form>
          {linkError && <Alert variant="danger" className="mt-2">{linkError}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowLinkMeetingModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submitLinkMeeting}
            disabled={isLinkingMeeting || !newLinkedMeetingName.trim()}
          >
            {isLinkingMeeting ? <Spinner animation="border" size="sm" /> : 'Link Meeting'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default DashboardPage;