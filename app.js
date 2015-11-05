var express = require('express')
var app = express(); //express();
var mongoose = require('mongoose');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var moment = require('moment');
var calendar = google.calendar('v3');
var plus = google.plus('v1');
var gmail = google.gmail('v1');
var event = require('./models/event.js')
var scopes = [
    'https://www.googleapis.com/auth/plus.login',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/gmail.readonly'
];

//var jwt = require('jsonwebtoken');

var Teacher = require('./models/teacher.js');
//var Picture = require('./models/picture.js');

var args = process.argv.slice(2);
var uri = "mongodb://" + args[0] + ":" + args[1] + "@ds049094.mongolab.com:49094/mark";

//CORS middleware
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-access-token');

    next();
};

app.use(allowCrossDomain);
var bodyParser = require('body-parser');

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

//connect to db
mongoose.connect(uri);

//mock credentials
var credentials = {
    client_secret: 'S6Ci98s5LLfUiJQtJOHDxgZc',
    client_id: '583974961860-ccif00l0ug670vvs1r8doli4g8lotd81.apps.googleusercontent.com',
    redirect_uris: ["http://mark-vwalia.c9.io/api/authCallback"]
};

var clientSecret = credentials.client_secret;
var clientId = credentials.client_id;
var redirectUrl = credentials.redirect_uris[0];
var auth = new googleAuth();
var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
var authed = false;
var authUrl = oauth2Client.generateAuthUrl({
    approval_prompt: 'force',
    access_type: 'offline',
    scope: scopes
});
var router = express.Router();
router.route('/register')
    .post(function(req, res) {
        var username = req.body.username;
        var password = req.body.password;
        var email = req.body.email;
        if (!username || !password || !email) {
            res.json({
                message: 'provide all required fields'
            });
        }
        else {
            var newTeacher = new Teacher({
                username: username,
                password: password,
                email: email
            });
            newTeacher.save(function(err) {
                if (err) {
                    res.send(err);
                    return;
                }
                res.json({
                    message: 'Teacher \'' + username + '\' created'
                });
            });
        }
    });

router.route('/authenticate')
    .get(function(req, res) {
        if (!authed) {

            // Generate an OAuth URL and redirect there
            var url = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                approval_prompt: 'force',
                scope: scopes //'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/plus.login'
            });
            res.redirect(url);
        }
        else {
            plus.people.get({
                userId: 'me',
                auth: oauth2Client
            }, function(err, response) {
                // handle err and response
                if (err) console.warn(err);

                //user is authenticated, find teacher object using email and store auth in it
                var emailObj = response.emails[0];
                Teacher.findOne({
                    email: emailObj.value
                }, function(err, teacher) {
                    if (err) {
                        res.send(err);
                        throw err;
                    }
                    //teacher should exist by now
                    if (!teacher) {
                        res.json({
                            success: false,
                            message: 'teacher not found',
                            data: {}
                        });
                        return;
                    }
                    teacher.oauth2Client = oauth2Client;
                    console.warn("normal:" + oauth2Client);
                    console.log(JSON.stringify(oauth2Client))
                    teacher.save();
                    var today = moment().format('YYYY-MM-DD') + 'T';
                    calendar.events.list({
                        calendarId: emailObj.value, //'primary',
                        maxResults: 20,
                        timeMin: today + '00:00:00.000Z',
                        timeMax: today + '23:59:59.000Z',
                        auth: teacher.oauth2Client
                    }, function(err, events) {
                        if (err) {
                            console.log('Error fetching events');
                            console.log(err);
                        }
                        else {
                            // Send our JSON response back to the browser
                            console.log('Successfully fetched events');
                        }
                    });
                    res.redirect('/api/events/teacher/' + emailObj.value);
                });
                /*
                //code to get events
                var today = moment().format('YYYY-MM-DD') + 'T';
                calendar.events.list({
                    calendarId: emailObj.value, //'primary',
                    maxResults: 20,
                    timeMin: today + '00:00:00.000Z',
                    timeMax: today + '23:59:59.000Z',
                    auth: oauth2Client
                }, function(err, events) {
                    if (err) {
                        console.log('Error fetching events');
                        console.log(err);
                    }
                    else {
                        // Send our JSON response back to the browser
                        console.log('Successfully fetched events');
                    }
                });*/
            });
        }
    });

router.route('/authCallback')
    .get(function(req, res) {
        //console.log(res);
        var code = req.param('code');
        if (code) {
            console.log(oauth2Client);
            // Get an access token based on our OAuth code
            oauth2Client.getToken(code, function(err, tokens) {
                if (err) {
                    console.log('Error authenticating')
                    console.log(err);
                }
                else {
                    console.log('Successfully authenticated');
                    console.log(oauth2Client.clientId);
                    console.log(tokens);
                    // Store our credentials and redirect back to our main page
                    oauth2Client.credentials = tokens;
                    authed = true;
                    res.redirect('/api/authenticate');
                }
            });
        }
    });
router.route('/events/teacher/:teacherEmail')
    .get(function(req, res) {
        var email = req.params.teacherEmail;
        console.warn(email);
        Teacher.findOne({
            email: email
        }, function(err, teacher) {
            if (err) {
                res.send(err);
                throw err;
            }
            if (teacher) {
                //fetch and return events
                console.warn(teacher);
                var oauth2ClientDummy = new auth.OAuth2(clientId, clientSecret, redirectUrl);
                oauth2ClientDummy.credentials = teacher.oauth2Client.credentials;
                var today = moment().format('YYYY-MM-DD') + 'T';
                calendar.events.list({
                    calendarId: email, //'primary',
                    maxResults: 20,
                    timeMin: today + '00:00:00.000Z',
                    timeMax: today + '23:59:59.000Z',
                    auth: oauth2ClientDummy
                }, function(err, events) {
                    if (err) {
                        console.log('Error fetching events');
                        console.log(err);
                    }
                    else {
                        // Send our JSON response back to the browser
                        console.log('Successfully fetched events');
                        res.json({
                            success: true,
                            message: '',
                            data: events
                        });
                    }
                });
            }
            else {
                res.json({
                    success: false,
                    message: 'teacher not found',
                    data: {}
                });
            }

        });
    })
    .post(function(req, res) {
        var email = req.params.teacherEmail;
        console.warn(email);
        Teacher.findOne({
            email: email
        }, function(err, teacher) {
            if (err) {
                res.send(err);
                throw err;
            }
            if (!teacher) {
                res.json({
                    success: false,
                    message: 'teacher not found',
                    data: {}
                });
            }
            else {
                //check studentname and start datetime provided
                var studentName = req.body.studentName;
                var start = req.body.start;
                if (!studentName || !start) {
                    res.json({
                        success: false,
                        message: 'provide all required fields',
                        data: {}
                    });
                    return;
                }
                //[TODO]check for overlap with existing events
                var event = {
                    'summary': 'Google I/O 2015',
                    'location': '800 Howard St., San Francisco, CA 94103',
                    'description': 'A chance to hear more about Google\'s developer products.',
                    'start': {
                        'dateTime': '2015-05-28T09:00:00-07:00',
                        'timeZone': 'America/Los_Angeles',
                    },
                    'end': {
                        'dateTime': '2015-05-28T17:00:00-07:00',
                        'timeZone': 'America/Los_Angeles',
                    },
                    'recurrence': [
                        'RRULE:FREQ=DAILY;COUNT=2'
                    ],
                    'attendees': [{
                        'email': 'lpage@example.com'
                    }, {
                        'email': 'sbrin@example.com'
                    }, ],
                    'reminders': {
                        'useDefault': false,
                        'overrides': [{
                            'method': 'email',
                            'minutes': 24 * 60
                        }, {
                            'method': 'popup',
                            'minutes': 10
                        }, ],
                    },
                };
                var newEvent = event;
                newEvent.summary = email;
                newEvent.description = 'Blocked by ' + studentName;
                newEvent.start.dateTime = start;
                newEvent.end.dateTime = '2015-11-06T10:00:00-07:00'; //moment(start) + '00:00:00.000Z';
                console.log(JSON.stringify(newEvent)); //[remove]

                var oauth2ClientDummy = new auth.OAuth2(clientId, clientSecret, redirectUrl);
                oauth2ClientDummy.credentials = teacher.oauth2Client.credentials;

                calendar.events.insert({
                    auth: oauth2ClientDummy,
                    calendarId: email,
                    resource: event //JSON.stringify(newEvent),
                }, function(err, event) {
                    if (err) {
                        console.log('There was an error contacting the Calendar service: ' + err);
                        res.send(err);
                        return;
                    }
                    res.json({
                        success: true,
                        message: 'Event created',
                        data: {
                            link: event.htmlLink
                        }
                    });
                });
            }
        });
    });
app.use('/api', router);
app.listen(process.env.PORT, function() {
    console.log('server started');
});