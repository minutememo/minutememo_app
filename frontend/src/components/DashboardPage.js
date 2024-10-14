// components/DashboardPage.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext';
import { Container, Table, Button, Spinner } from 'react-bootstrap';
import '../styles.css';

const DashboardPage = ({ selectedHub, meetingHubs, setActiveHubName }) => {  // Use meetingHubs and setActiveHubName from props
  const { user } = useUser(); // Get the user context
  const [meetings, setMeetings] = useState([]);
  const [meetingSessions, setMeetingSessions] = useState([]);
  const [recurringEvents, setRecurringEvents] = useState([]); // State for recurring events
  const [error, setError] = useState('');
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [subscriptionEmpty, setSubscriptionEmpty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newMeetingName, setNewMeetingName] = useState(''); // For the new meeting input
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false); // Track the creation process
  const navigate = useNavigate();

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
              setSubscriptionActive(true);
            } else if (response.data.is_empty) {
              setSubscriptionEmpty(true);
            } else {
              setSubscriptionActive(false);
              navigate('/subscribe');
            }
          } else {
            setError('Failed to fetch subscription status');
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
      setIsLoading(false);
    }
  }, [user, backendUrl, navigate]);

  // Fetch recurring calendar events starting from today
  const fetchCalendarEvents = async () => {
    try {
      const today = new Date(); // Get today's date
      const sixMonthsAhead = new Date(); // Calculate 6 months ahead
      sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);
      
      console.log(`Fetching events starting from ${today.toISOString()} to ${sixMonthsAhead.toISOString()}`);

      const response = await axios.get(`${backendUrl}/api/calendar/events`, {
        params: {
          start: today.toISOString(),  // Use today's date as the start point
          end: sixMonthsAhead.toISOString(), // Use a future date as the end point (6 months ahead)
          singleEvents: false, // Don't expand recurring events
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

        // Filtering for recurring events
        const recurring = eventsWithDateObjects.filter(event => event.recurringEventId);

        if (recurring.length === 0) {
          console.log('No recurring events found');
        } else {
          console.log(`Found ${recurring.length} recurring events.`);
        }

        // Ensure only unique recurring events
        const uniqueRecurringEvents = recurring.reduce((acc, event) => {
          if (!acc[event.recurringEventId]) {
            acc[event.recurringEventId] = event;
          }
          return acc;
        }, {});

        const recurringEventsArray = Object.values(uniqueRecurringEvents);
        console.log(`Unique recurring events count: ${recurringEventsArray.length}`);

        // Fetch linked meetings for each recurring event
        const linkedEvents = await Promise.all(
          recurringEventsArray.map(async (event, index) => {
            console.log(`Fetching linked meeting for recurring event ${index + 1} with ID: ${event.recurringEventId}`);
            try {
              const linkedResponse = await axios.get(`${backendUrl}/api/recurring-event/${event.recurringEventId}`);
              if (linkedResponse.status === 200) {
                console.log(`Linked meeting found for event ${index + 1}: ${linkedResponse.data.meeting_name}`);
                return { ...event, linkedMeeting: linkedResponse.data.meeting_name };
              } else {
                console.log(`No linked meeting found for event ${index + 1}`);
                return { ...event, linkedMeeting: null };
              }
            } catch (err) {
              console.error(`Error fetching linked meeting for event ${index + 1}:`, err);
              return { ...event, linkedMeeting: null };
            }
          })
        );

        setRecurringEvents(linkedEvents);  // Set the state
      } else {
        console.error('Failed to fetch calendar events. Response status:', response.status);
        setError('Failed to fetch calendar events');
      }
    } catch (err) {
      console.error('Error fetching calendar events:', err);
      setError('Error fetching calendar events');
    }
  };

  // Fetch meetings and meeting sessions
  useEffect(() => {
    if (selectedHub && subscriptionActive) {
      const fetchMeetings = async () => {
        try {
          console.log('Fetching meetings...');
          const response = await axios.get(`${backendUrl}/api/meetings?hub_id=${selectedHub}`);
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
          const response = await axios.get(`${backendUrl}/api/meetingsessions?hub_id=${selectedHub}`);
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
      fetchCalendarEvents(); // Fetch recurring events starting from today
    } else {
      console.log('Selected Hub or Subscription not active. Skipping fetch.');
    }
  }, [selectedHub, backendUrl, subscriptionActive]);

  // Update active hub name
  const updateActiveHubName = (hubId, hubs = meetingHubs) => {
    const hub = hubs.find(hub => hub.id === parseInt(hubId, 10));
    if (hub) {
      setActiveHubName(hub.name);
    } else {
      setActiveHubName('No Meeting Hub Selected');
    }
  };

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
      });
      if (response.status === 201) {
        setMeetings((prevMeetings) => [...prevMeetings, { id: response.data.meeting_session_id, name: newMeetingName }]);
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
  const handleLinkMeeting = async (recurringEventId) => {
    const meetingName = prompt('Enter a new meeting name to link with this recurring event:');

    if (meetingName) {
      try {
        const response = await axios.post(`${backendUrl}/api/recurring-event/${recurringEventId}/link`, {
          meeting_name: meetingName,
        });
        if (response.status === 201) {
          setError('');
          alert('Meeting created and linked to the recurring event');
          fetchCalendarEvents(); // Refresh events after linking
        } else {
          setError('Failed to link meeting');
        }
      } catch (err) {
        console.error('Error linking meeting to recurring event:', err);
        setError('Error linking meeting to recurring event');
      }
    }
  };

  if (!user) {
    return <p>Please log in to access your dashboard.</p>;
  }

  if (isLoading) {
    return <p>Checking subscription status...</p>;
  }

  if (subscriptionEmpty) {
    return (
      <div className="dashboard">
        <h3>No Subscription Found</h3>
        <p>
          Please <Link to="/subscribe">subscribe</Link> to access your dashboard.
        </p>
      </div>
    );
  }

  if (!subscriptionActive) {
    return <p>Your subscription is inactive. Please <Link to="/subscribe">subscribe</Link> to continue.</p>;
  }

  return (
    <div className="dashboard">
      <Container>
        {/* Create New Meeting Section */}
        <div className="box-shadow-container mb-4">
          <h3>Create a New Meeting</h3>
          <div className="d-flex">
            <input
              type="text"
              placeholder="Enter meeting name"
              value={newMeetingName}
              onChange={(e) => setNewMeetingName(e.target.value)}
              className="form-control me-2"
            />
            <Button onClick={handleCreateMeeting} disabled={isCreatingMeeting}>
              {isCreatingMeeting ? <Spinner animation="border" size="sm" /> : 'Create Meeting'}
            </Button>
          </div>
          {error && <p className="error-message">{error}</p>}
        </div>

        {/* Meetings List */}
        <div className="box-shadow-container mb-4">
          <h3>Meetings</h3>
          {error && <p className="error-message">{error}</p>}
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
        <div className="box-shadow-container mb-4">
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
                    <td>{event.linkedMeeting ? event.linkedMeeting : 'Not linked'}</td>
                    <td>
                      {event.linkedMeeting ? (
                        <Button variant="success" size="sm" disabled>
                          Linked
                        </Button>
                      ) : (
                        <Button variant="primary" size="sm" onClick={() => handleLinkMeeting(event.recurringEventId)}>
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

        {/* Meeting Sessions */}
        <div className="box-shadow-container">
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
    </div>
  );
};

export default DashboardPage;