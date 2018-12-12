var app = require('http').createServer(handler);
var io = require('socket.io')(app);
var fs = require('fs');
const util = require('./utilities.js');
const socketUtils = require('./socketUtils.js');
var mySocket;

console.log('selectedSensor: ' + socketUtils.selectedSensor);
console.log(util.getCurrentDateTime());

const maxAllowedDataNbOfChars = 50;

const changeUpdatePeriodEventName = 'changeUpdatePeriod';
const sensorChangedEventName = 'sensorChanged';

function handler(req, res) {
    if (req.method === 'POST') {
        var body = '';
        req.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to string
        });
        req.on('end', () => {
            console.log("body.length = " + body.length + ", maxAllowedDataNbOfChars: " + maxAllowedDataNbOfChars);
            if (body.length > maxAllowedDataNbOfChars) {//To curb random internet post calls to my VPS
                res.end("403"); //403 = Forbidden
            } else {
                socketUtils.updateFileAndPlot(mySocket, body);
                res.end(socketUtils.getUpdateTimePeriodsForActiveSensor_ms().toString()); //send updateTimePeriod to sensor
                //res.end('ok from Samil VPS);
            }
        });
    } else {
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
    if (mySocket !== undefined) {
        socketUtils.showUpdatePeriodsForUserSelectedSensor(mySocket);
    }
}

io.on('connection', function (socket) {
    mySocket = socket;
    console.log('A new WebSocket connection has been established');
    socketUtils.plotSensorData(mySocket, socketUtils.selectedSensor);

    mySocket.on('disconnect', function () {
        console.log('WS client disconnect!');
    });

    mySocket.on(changeUpdatePeriodEventName, function (updatePeriod) {
        socketUtils.changeUpdatePeriodForUserSelectedSensor(mySocket, updatePeriod);
    });

    mySocket.on(sensorChangedEventName, function (sensorID) {
        socketUtils.plotSensorData(mySocket, sensorID);
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
