import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css'; // Include calendar styles

const localizer = momentLocalizer(moment);

const GoogleCalendarEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch the calendar events
  useEffect(() => {
    const fetchCalendarEvents = async () => {
      try {
        console.log('Fetching calendar events...');  // Add this log before axios call

        const response = await axios.get('http://localhost:5000/api/calendar/events', {
          withCredentials: true,
        });

        if (response.status === 200) {
          console.log('API Response:', response.data);  // Log the raw response from the API
          const formattedEvents = response.data.map(event => {
            console.log('Raw Event Start:', event.start);  // Log the start time to check the format
            console.log('Raw Event End:', event.end);      // Log the end time to check the format
            return {
              title: event.summary,
              start: new Date(event.start.dateTime || event.start.date),  // Convert to Date object
              end: new Date(event.end.dateTime || event.end.date),        // Convert to Date object
            };
          });
          console.log('Formatted Events:', formattedEvents);  // Log the formatted events
          setEvents(formattedEvents);  // Store events in state
        } else {
          setError('Failed to fetch calendar events');
        }
      } catch (err) {
        console.log('Error fetching events', err);  // Log errors for more details
        setError('Error fetching calendar events');
      } finally {
        setLoading(false);
      }
    };

    fetchCalendarEvents();
  }, []);

  if (loading) {
    return <p>Loading events...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <div className="calendar-page" style={{ padding: '20px' }}>
      <h2>Calendar Events</h2>
      <div style={{ height: '80vh', maxWidth: '100%' }}>
        <Calendar
          localizer={localizer}
          events={events}  // Pass the formatted events to the calendar
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
        />
      </div>
    </div>
  );
};

export default GoogleCalendarEvents;