var app = require('http').createServer(handler);
var io = require('socket.io')(app);
var fs = require('fs');
const util = require('./utilities.js');
const socketUtils = require('./socketUtils.js');
var activeSocket;

const maxNbOfAllowedCharsInPostRequestBody = 50;

console.log('selectedSensor: ' + socketUtils.selectedSensorID);
console.log(util.getCurrentDateTime());

const changeUpdatePeriodEventName = 'changeUpdatePeriod';
const sensorChangedEventName = 'sensorChanged';

function handler(req, res) {
    if (req.method === 'POST') { //if sensor has sent data to server
        var body = '';
        req.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to string
        });
        req.on('end', () => {
            if (body.length <= maxNbOfAllowedCharsInPostRequestBody) {
                socketUtils.updateFileAndPlot(activeSocket, body);
                res.end(socketUtils.getUpdateTimePeriodsForActiveSensor_ms().toString()); //send updateTimePeriod to sensor
            } else {
                var ipRemote = req.headers['x-forwarded-for'] ||
                    req.connection.remoteAddress ||
                    req.socket.remoteAddress ||
                    (req.connection.socket ? req.connection.socket.remoteAddress : null);
                console.error("Invalid post request! ipRemote: " + ipRemote + ", body.length (" + body.length + ") > maxNbOfAllowedChars (" + maxNbOfAllowedCharsInPostRequestBody + ")");
                //Do not return a response to requester because this post request might be from a network/port scanner.
            }
        });
    } else { //if browser connected to server
        fs.readFile(__dirname + '/myPage.html',
            function (err, data) {
                if (err) {
                    res.writeHead(500);
                    return res.end('Error loading myPage.html');
                }
                res.writeHead(200);
                res.end(data);
            });
    }
    if (activeSocket !== undefined) {
        socketUtils.showUpdatePeriodsForUserSelectedSensor(activeSocket);
    }
}

io.on('connection', function (socket) {
    activeSocket = socket;
    console.log('A new WebSocket connection has been established');
    socketUtils.plotSensorData(socket, socketUtils.selectedSensorID);

    socket.on('disconnect', function () {
        console.log('WS client disconnect!');
    });

    socket.on(changeUpdatePeriodEventName, function (updatePeriod) {
        socketUtils.changeUpdatePeriodForUserSelectedSensor(socket, updatePeriod);
    });

    socket.on(sensorChangedEventName, function (sensorID) {
        socketUtils.plotSensorData(socket, sensorID);
    });
});

//app.listen(3060, '127.0.0.1', function () {
//app.listen(3060, '0.0.0.0', function () {
app.listen(3060, function () {
    console.log('Sensorbox server listening on *:3060');
}).on('error', function (err) {
    if (err.errno === 'EADDRINUSE') {
        console.log('ERROR: Port ' + err.port + ' is already in use! Have you forgotten to close previous server session?');
    } else {
        console.log(err);
    }
});
