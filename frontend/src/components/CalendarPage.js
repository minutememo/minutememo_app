import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import Modal from 'react-modal';
import axios from 'axios';

const localizer = momentLocalizer(moment);

// Set the app element for react-modal
Modal.setAppElement('#root');

// Event Creation Modal Component
const EventCreationModal = ({ isOpen, onClose, onCreateEvent, initialStart, initialEnd }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [attendees, setAttendees] = useState('');
    const [reminder, setReminder] = useState(10);
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrence, setRecurrence] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();

        const attendeesArray = attendees.split(',').map((email) => ({ email: email.trim() }));

        const newEvent = {
            summary: title,
            description,
            location,
            start: initialStart,
            end: initialEnd,
            attendees: attendeesArray,
            reminders: {
                useDefault: false,
                overrides: [{ method: 'email', minutes: reminder }],
            },
            recurrence: isRecurring ? [recurrence] : [],
        };

        onCreateEvent(newEvent);
        onClose();
    };

    const handleClose = () => {
        // Clear form fields when modal is closed
        setTitle('');
        setDescription('');
        setLocation('');
        setAttendees('');
        setReminder(10);
        setIsRecurring(false);
        setRecurrence('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onRequestClose={handleClose} contentLabel="Create Event Modal">
            <h2>Create New Event</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>Event Title:</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label>Description:</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div>
                    <label>Location:</label>
                    <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div>
                    <label>Attendees (comma-separated emails):</label>
                    <input
                        type="text"
                        value={attendees}
                        onChange={(e) => setAttendees(e.target.value)}
                    />
                </div>
                <div>
                    <label>Reminder (minutes before event):</label>
                    <input
                        type="number"
                        value={reminder}
                        onChange={(e) => setReminder(e.target.value)}
                    />
                </div>
                <div>
                    <label>
                        <input
                            type="checkbox"
                            checked={isRecurring}
                            onChange={(e) => setIsRecurring(e.target.checked)}
                        />
                        Recurring Event
                    </label>
                    {isRecurring && (
                        <div>
                            <label>Recurrence Rule:</label>
                            <input
                                type="text"
                                placeholder="e.g., RRULE:FREQ=DAILY;COUNT=5"
                                value={recurrence}
                                onChange={(e) => setRecurrence(e.target.value)}
                            />
                        </div>
                    )}
                </div>
                <div>
                    <button type="submit">Create Event</button>
                    <button type="button" onClick={handleClose}>
                        Cancel
                    </button>
                </div>
            </form>
        </Modal>
    );
};

const CalendarPage = () => {
    const [events, setEvents] = useState([]);
    const [isModalOpen, setModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [currentRange, setCurrentRange] = useState(null); // Keep track of current range
    const navigate = useNavigate();
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'; // Use env variable

    // Function to fetch calendar events for a given date range
    const fetchCalendarEvents = async (start, end) => {
        try {
            const response = await axios.get(`${backendUrl}/api/calendar/events`, { // Use backendUrl
                params: {
                    start: start.toISOString(),  // Ensure this is passed as an ISO string
                    end: end.toISOString(),      // Ensure this is passed as an ISO string
                },
            });
            console.log('Fetched Calendar Events:', response.data); // Log response

            // Convert event start and end to Date objects
            const eventsWithDateObjects = response.data.map(event => ({
                ...event,
                start: new Date(event.start),
                end: new Date(event.end),
            }));

            setEvents(eventsWithDateObjects);
        } catch (error) {
            console.error('Error fetching calendar events:', error);
        }
    };

    // Trigger API call when the calendar's visible range changes
    const handleRangeChange = (range) => {
        let start, end;
        // Check if range is an object with start and end dates (common for week/day view)
        if (range.start && range.end) {
            start = range.start;
            end = range.end;
        } 
        // Check if range is an array (common for month view)
        else if (Array.isArray(range) && range.length === 2) {
            start = range[0];
            end = range[1];
        } else {
            console.error('Invalid range:', range);
            return;
        }
    
        // Check if start and end are valid dates
        if (start && end && !isNaN(new Date(start)) && !isNaN(new Date(end))) {
            // Store the current range
            setCurrentRange({ start: new Date(start), end: new Date(end) });
            // Fetch events within the selected date range
            fetchCalendarEvents(new Date(start), new Date(end));
        } else {
            console.error('Invalid start or end date:', start, end);
        }
    };

    const handleSelectSlot = (slotInfo) => {
        setSelectedSlot(slotInfo);
        setModalOpen(true);
    };

    const handleCreateEvent = async (newEvent) => {
        try {
            const response = await fetch(`${backendUrl}/api/google-calendar/create-event`, { // Use backendUrl
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newEvent),
            });

            if (response.ok) {
                const createdEvent = await response.json();
                console.log('Event created successfully:', createdEvent);
                // Refresh events within the current range after creation
                if (currentRange) {
                    fetchCalendarEvents(currentRange.start, currentRange.end);
                }
            } else {
                console.error('Failed to create event.');
            }
        } catch (error) {
            console.error('Error creating event:', error);
        }
    };

    useEffect(() => {
        // Initialize the events by fetching the current month/week range on load
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        handleRangeChange({ start: monthStart, end: monthEnd });
    }, []);

    return (
        <div className="calendar-page" style={{ padding: '20px' }}>
            <h2>Calendar Events</h2>

            {/* Calendar */}
            <div style={{ height: '80vh', maxWidth: '100%' }}>
                <Calendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    selectable
                    onSelectSlot={handleSelectSlot}
                    onSelectEvent={(event) => navigate(`/event/${event.id}`, { state: { event } })}
                    onRangeChange={handleRangeChange}  // Listen for visible range changes
                />
            </div>

            {/* Display Modal for creating new events */}
            {selectedSlot && (
                <EventCreationModal
                    isOpen={isModalOpen}
                    onClose={() => setModalOpen(false)}
                    onCreateEvent={handleCreateEvent}
                    initialStart={selectedSlot.start}
                    initialEnd={selectedSlot.end}
                />
            )}

            {/* Table displaying all events */}
            <div style={{ marginTop: '20px' }}>
                <h3>All Fetched Events</h3>
                <table className="event-table" border="1" cellPadding="10">
                    <thead>
                        <tr>
                            <th>Event Title</th>
                            <th>Start Time</th>
                            <th>End Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {events.map((event) => (
                            <tr key={event.id}>
                                <td>{event.summary || 'No Title'}</td>
                                <td>{event.start ? new Date(event.start).toISOString() : 'Invalid date'}</td> {/* Display Date as ISO string */}
                                <td>{event.end ? new Date(event.end).toISOString() : 'Invalid date'}</td>   {/* Display Date as ISO string */}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CalendarPage;