import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom'; // Get params and state
import axios from 'axios';

const EventDetailsPage = () => {
  const { eventId } = useParams(); // Get the event ID from the route
  const location = useLocation();  // Get state passed via navigate
  const [eventDetails, setEventDetails] = useState(location.state?.event || null); // Use state if available
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!location.state?.event); // Avoid loading if event is in state
  const [meetings, setMeetings] = useState([]);  // Store meetings linked to the event

  // Fetch event details if not passed via state
  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!eventDetails) {
        setLoading(true);
        try {
          const response = await axios.get(`/api/calendar/event/${eventId}`);
          if (response.status === 200) {
            setEventDetails(response.data);
          } else {
            setError('Failed to fetch event details');
          }
        } catch (err) {
          setError('Error fetching event details');
        } finally {
          setLoading(false); // Stop loading
        }
      }
    };

    fetchEventDetails();
  }, [eventId, eventDetails]);

  // Fetch available meetings linked to the hub
  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const hubId = eventDetails?.hubId; // Get the hub ID from eventDetails or wherever it's available
        if (hubId) {
          const response = await axios.get(`/api/meetings?hub_id=${hubId}`);
          if (response.status === 200 && response.data.meetings) {
            setMeetings(response.data.meetings); // Set the list of meetings
          } else {
            setError('Failed to fetch meetings');
          }
        }
      } catch (err) {
        setError('Error fetching meetings');
      }
    };

    if (eventDetails) {
      fetchMeetings(); // Fetch meetings only after event details are loaded
    }
  }, [eventDetails]);

  const handleLinkMeeting = async (meetingId) => {
    try {
      const response = await axios.post(`/api/link-event-meeting`, {
        eventId,
        meetingId,
      });
      if (response.status === 200) {
        alert('Event successfully linked to the meeting');
      } else {
        alert('Failed to link event to the meeting');
      }
    } catch (err) {
      alert('Error linking event to meeting');
    }
  };

  if (loading) {
    return <p>Loading event details...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (!eventDetails) {
    return <p>No event details available.</p>;
  }

  const isRecurring = eventDetails.recurrence || eventDetails.recurringEventId; // Check if event is recurring

  return (
    <div>
      <h2>Event Details</h2>
      <p><strong>Title:</strong> {eventDetails.summary}</p>
      <p><strong>Description:</strong> {eventDetails.description || 'No description'}</p>
      <p><strong>Start:</strong> {new Date(eventDetails.start.dateTime || eventDetails.start.date).toLocaleString()}</p>
      <p><strong>End:</strong> {new Date(eventDetails.end.dateTime || eventDetails.end.date).toLocaleString()}</p>
      <p><strong>Location:</strong> {eventDetails.location || 'No location'}</p>
      
      {/* Show if the event is recurring */}
      <p><strong>Recurring:</strong> {isRecurring ? 'Yes' : 'No'}</p>

      <p><strong>Attendees:</strong></p>
      <ul>
        {eventDetails.attendees ? (
          eventDetails.attendees.map((attendee, index) => (
            <li key={index}>{attendee.email} {attendee.responseStatus && `- ${attendee.responseStatus}`}</li>
          ))
        ) : (
          <li>No attendees</li>
        )}
      </ul>
      <p><strong>Organizer:</strong> {eventDetails.organizer?.email || 'No organizer'}</p>
      <p><strong>Created:</strong> {new Date(eventDetails.created).toLocaleString()}</p>
      <p><strong>Updated:</strong> {new Date(eventDetails.updated).toLocaleString()}</p>

      {/* Dropdown to select a meeting to link to */}
      <div>
        <label>Select a Meeting to Link:</label>
        <select onChange={(e) => handleLinkMeeting(e.target.value)} defaultValue="">
          <option value="" disabled>Select a meeting</option>
          {meetings.map((meeting) => (
            <option key={meeting.id} value={meeting.id}>
              {meeting.name} {meeting.is_recurring ? '(Recurring)' : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default EventDetailsPage;