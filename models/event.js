var event = {
    summary: '',
    location: '',
    description: '',
    start: {
        dateTime: '',
        timeZone: 'Asia/Calcutta',
    },
    end: {
        dateTime: '',
        timeZone: 'Asia/Calcutta',
    },
    recurrence: [
        'RRULE:FREQ=DAILY;COUNT=2'
    ],
    attendees: [],
    reminders: {
        useDefault: false,
        overrides: [{
            method: 'email',
            minutes: 24 * 60
        }, {
            method: 'popup',
            minutes: 10
        }, ],
    },
}
module.exports = event;