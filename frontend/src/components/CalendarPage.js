import React from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { useNavigate } from 'react-router-dom'; // Use for navigation
import 'react-big-calendar/lib/css/react-big-calendar.css'; // Import styles for the calendar

const localizer = momentLocalizer(moment);

const CalendarPage = ({ events }) => {
  const navigate = useNavigate(); // Hook for navigation

  // Map your events data to the format required by the Calendar component
  const formattedEvents = events.map(event => ({
    ...event,
    title: event.summary,
    start: new Date(event.start.dateTime || event.start.date), // Use dateTime or date depending on the event type
    end: new Date(event.end.dateTime || event.end.date),       // Use dateTime or date depending on the event type
  }));

  // Handle event click
  const handleSelectEvent = (event) => {
    navigate(`/event/${event.id}`, { state: { event } }); // Pass event data to EventDetailsPage
  };

  return (
    <div className="calendar-page" style={{ padding: '20px' }}>
      <h2>Calendar Events</h2>

      {/* Calendar displaying all events */}
      <div style={{ height: '80vh', maxWidth: '100%' }}>
        <Calendar
          localizer={localizer}
          events={formattedEvents}  // Pass the formatted events to the calendar
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          onSelectEvent={handleSelectEvent} // Handle event selection
        />
      </div>
    </div>
  );
};

export default CalendarPage;