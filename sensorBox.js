var app = require('http').createServer(handler);
var io = require('socket.io')(app);
var fs = require('fs');
const util = require('./utilities.js');
const socketUtils = require('./socketUtils.js');

const maxNbOfAllowedCharsInPostRequestBody = 50;

const changeUpdatePeriodEventName = 'changeUpdatePeriod';
const sensorChangedEventName = 'sensorChanged';

var connections = []; //array holding all active connections.

function updatePlots(dataFromSensor, res) {
    console.log(util.getCurrentDateTimeMs(), "updatePlots()");
    for (var i = 0; i < connections.length; i++) {
        const connection = connections[i];
        socketUtils.plotSensorData(connection.socket, connection.userSelectedSensorID);
    }
    var s = dataFromSensor.split(',');
    if (s.length == 4) {//sensor id exists in dataFromSensor
        sensorID = s[3].trim();
        res.end(socketUtils.getUpdateTimePeriodsForSensor_ms(sensorID).toString()); //send updateTimePeriod to sensor
    } else {
        res.end(periodMap[socketUtils.updatePeriodOneHour].toString()); //send default updateTimePeriod to sensor
    }
}

function handler(req, res) {
    if (req.method === 'POST') { //if sensor has sent data to server
        var dataFromSensor = '';
        req.on('data', chunk => {
            dataFromSensor += chunk.toString(); // convert Buffer to string
        });
        req.on('end', () => {
            if (dataFromSensor.length <= maxNbOfAllowedCharsInPostRequestBody) {
                socketUtils.appendSensorDataToFile(dataFromSensor, res, updatePlots);
            } else {
                var ipRemote = req.headers['x-forwarded-for'] ||
                    req.connection.remoteAddress ||
                    req.socket.remoteAddress ||
                    (req.connection.socket ? req.connection.socket.remoteAddress : null);
                console.error("handler() Invalid post request! ipRemote: " + ipRemote + ", body.length (" + dataFromSensor.length + ") > maxNbOfAllowedChars (" + maxNbOfAllowedCharsInPostRequestBody + ")");
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
}

io.on('connection', function (socket) {
    var connection = {
        socket: socket,
        userSelectedSensorID: socketUtils.defaultSelectedSensorID
    }
    connections.push(connection);
    console.log(util.getCurrentDateTimeMs(), 'A new WebSocket connection has been established');
    console.log(util.getCurrentDateTimeMs(), "IP: " + socket.request.connection.remoteAddress + ", socket.id: " + socket.id);
    socketUtils.plotSensorData(socket, connection.userSelectedSensorID);

    socket.on('disconnect', function () {
        console.log(util.getCurrentDateTimeMs(), 'WS client disconnect!');
        for (var i = 0; i < connections.length; i++) {
            const connect = connections[i];
            if (connect.socket.id === socket.id) {
                connections.splice(i, 1); //remove connection from array
                console.log(util.getCurrentDateTimeMs(), "Removed socket from connections. id: " + socket.id + ". connections.length = " + connections.length);
                break;
            }
        }
    });

    socket.on(changeUpdatePeriodEventName, function (updatePeriod) {
        socketUtils.changeUpdatePeriodForUserSelectedSensor(socket, connection.userSelectedSensorID, updatePeriod);
    });

    socket.on(sensorChangedEventName, function (sensorID) {
        connection.userSelectedSensorID = sensorID;
        socketUtils.plotSensorData(socket, sensorID);
    });
});

//app.listen(3060, '127.0.0.1', function () {
//app.listen(3060, '0.0.0.0', function () {
app.listen(3060, function () {
    console.log(util.getCurrentDateTimeMs(), 'Sensorbox server listening on *:3060');
}).on('error', function (err) {
    if (err.errno === 'EADDRINUSE') {
        console.log(util.getCurrentDateTimeMs(), 'ERROR: Port ' + err.port + ' is already in use! Have you forgotten to close previous server session?');
    } else {
        console.log(util.getCurrentDateTimeMs(), err);
    }
});
