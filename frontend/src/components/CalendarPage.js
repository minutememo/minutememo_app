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
            start: {
                dateTime: initialStart.toISOString(),
                timeZone: 'UTC' // Adjust as needed
            },
            end: {
                dateTime: initialEnd.toISOString(),
                timeZone: 'UTC' // Adjust as needed
            },
            attendees: attendeesArray,
            reminders: {
                useDefault: false,
                overrides: [{ method: 'email', minutes: parseInt(reminder, 10) }],
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
    const [currentRange, setCurrentRange] = useState(null);
    const [userSSO, setUserSSO] = useState(null); 
    const [isLoadingSSO, setIsLoadingSSO] = useState(true); 
    const navigate = useNavigate();
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

    // Fetch user SSO platform on component load
    useEffect(() => {
        const fetchUserSSOPlatform = async () => {
            try {
                console.log("Fetching user's SSO platform...");
                const response = await axios.get(`${backendUrl}/api/user-sso-platform`);
                console.log("SSO platform response:", response.data);
                setUserSSO(response.data.sso_platform);
                if (response.data.sso_platform === 'google') {
                    console.log("Google SSO detected; ready to fetch Google events.");
                } else if (response.data.sso_platform === 'microsoft') {
                    console.log("Microsoft SSO detected; ready to fetch Microsoft events.");
                } else {
                    console.log("Unsupported SSO platform; skipping calendar fetch.");
                }
            } catch (error) {
                console.error("Error fetching user's SSO platform:", error);
            } finally {
                setIsLoadingSSO(false);
            }
        };

        fetchUserSSOPlatform();
    }, [backendUrl]);

    // Function to fetch calendar events for a given date range
    const fetchCalendarEvents = async (start, end) => {
        try {
            console.log(`Fetching calendar events from ${start.toISOString()} to ${end.toISOString()}`);
            
            // Prepare query parameters
            const params = {
                start: start.toISOString(),
                end: end.toISOString(),
            };

            // **Add singleEvents=true for Microsoft to expand recurring events**
            if (userSSO === 'microsoft') {
                params.singleEvents = 'true';
                params.sso_platform = 'microsoft'; // Pass the SSO platform
            } else if (userSSO === 'google') {
                params.sso_platform = 'google'; // Pass the SSO platform
            }

            const response = await axios.get(`${backendUrl}/api/calendar/events`, {
                params: params,
            });
            console.log('Fetched Calendar Events:', response.data);

            const eventsWithDateObjects = response.data.map(event => ({
                id: event.id,
                title: event.summary || event.subject, // Microsoft uses 'subject', Google uses 'summary'
                start: new Date(event.start.dateTime || event.start), // Microsoft returns {dateTime: "..."}, Google returns direct string
                end: new Date(event.end.dateTime || event.end),
                location: (event.location?.displayName || event.location || ''), // Microsoft has location in {displayName: "..."} format
                description: event.bodyPreview || event.description, // Microsoft uses 'bodyPreview'
                isRecurring: event.is_recurring || false,
                recurringEventId: event.recurringEventId || null,
                linkedMeeting: event.linked_meeting || null,
                meetingHubId: event.meeting_hub_id || null
            }));

            setEvents(eventsWithDateObjects);
        } catch (error) {
            console.error('Error fetching calendar events:', error);
        }
    };

    // Trigger API call when the calendar's visible range changes
    const handleRangeChange = (range) => {
        let start, end;
        if (range.start && range.end) {
            start = range.start;
            end = range.end;
        } else if (Array.isArray(range) && range.length === 2) {
            start = range[0];
            end = range[1];
        } else {
            console.error('Invalid range:', range);
            return;
        }

        if (start && end && !isNaN(new Date(start)) && !isNaN(new Date(end))) {
            setCurrentRange({ start: new Date(start), end: new Date(end) });
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
        const endpoint = userSSO === 'google' 
            ? '/api/calendar/create-event'
            : '/api/calendar/microsoft/create-event';

        try {
            console.log(`Creating new ${userSSO} Calendar event:`, newEvent);
            const response = await fetch(`${backendUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newEvent),
            });

            if (response.ok && currentRange) {
                const createdEvent = await response.json();
                console.log(`${userSSO} Event created successfully:`, createdEvent);
                fetchCalendarEvents(currentRange.start, currentRange.end);
            } else {
                console.error(`Failed to create ${userSSO} event.`);
            }
        } catch (error) {
            console.error(`Error creating ${userSSO} event:`, error);
        }
    };

    // Initial range fetch, now dependent on SSO loading
    useEffect(() => {
        if (!isLoadingSSO && userSSO) {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            handleRangeChange({ start: monthStart, end: monthEnd });
        }
    }, [isLoadingSSO, userSSO]);

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
                    titleAccessor="title"
                    style={{ height: '100%' }}
                    selectable
                    onSelectSlot={handleSelectSlot}
                    onSelectEvent={(event) => navigate(`/event/${event.id}`, { state: { event } })}
                    onRangeChange={handleRangeChange}
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
                                <td>{event.title || 'No Title'}</td>
                                <td>{event.start ? new Date(event.start).toLocaleString() : 'Invalid date'}</td>
                                <td>{event.end ? new Date(event.end).toLocaleString() : 'Invalid date'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CalendarPage;