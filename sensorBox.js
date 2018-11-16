var app = require('http').createServer(handler);
var io = require('socket.io')(app);
var fs = require('fs');
var mySocket;
var sensorList = { sensors: ["Şamil", "Murat"] };
var selectedSensor = sensorList.sensors[0];
console.log('selectedSensor: ' + selectedSensor);

const dataFileName = 'dataFile.json';

const plotDataFromServerEventName = 'plotDataFromServer';
const lastDataFromServerEventName = 'lastDataFromServer';
const changeUpdatePeriodEventName = 'changeUpdatePeriod';
const updateSensorRadioButtonsEventName = 'updateSensorRadioButtons';
const sensorChangedEventName = 'sensorChanged';
const showUpdatePeriodsEventName = 'showUpdatePeriods';

const periodMap = {
    '10s': 10 * 1000,
    '10min': 10 * 60 * 1000,
    '1hr': 1 * 60 * 60 * 1000,
    '3hr': 3 * 60 * 60 * 1000
}

var lastSensorDataArrivalTime;
var nextSensorUpdateTimePeriod_ms = 60 * 60 * 1000; //default update period is 1hr
var sensorUpdateTimePeriod_ms = nextSensorUpdateTimePeriod_ms;

function handler(req, res) {
    if (req.method === 'POST') {
        var body = '';
        req.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to string
        });
        req.on('end', () => {
            //Update file in server and plot in html:
            appendToFile(body);
            sensorUpdateTimePeriod_ms = nextSensorUpdateTimePeriod_ms;
            res.end(sensorUpdateTimePeriod_ms.toString());
            //res.end('ok');
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
        mySocket.emit('showUpdatePeriods', {
            current: getKeyByValue(periodMap, sensorUpdateTimePeriod_ms),
            next: getKeyByValue(periodMap, nextSensorUpdateTimePeriod_ms)
        });
    }
}

io.on('connection', function (socket) {
    mySocket = socket;
    console.log('A new WebSocket connection has been established');
    if (fs.existsSync(dataFileName)) {
        fs.readFile(dataFileName, 'utf8', function readFileCallback(err, dataInFile) {
            if (err) {
                console.log(err);
            } else {
                plotData(dataInFile);
                mySocket.emit(updateSensorRadioButtonsEventName, { sensorList, selectedSensor: selectedSensor });
            }
        });
    }

    function plotData(dataInFile) {
        var dataInServer = JSON.parse(dataInFile);
        //Update string in html:
        var lastData = lastSensorDataArrivalTime + ", Temp [" + String.fromCharCode(176) + "C], Humid[%], Pres [kPa] = " + dataInServer.temperature.y[dataInServer.temperature.y.length - 1] +
            ", " + dataInServer.humidity.y[dataInServer.humidity.y.length - 1] + ", " + dataInServer.pressure.y[dataInServer.pressure.y.length - 1];
        mySocket.emit(lastDataFromServerEventName, lastData);
        //Update plot in html:
        mySocket.emit(plotDataFromServerEventName, { dataInServer, selectedSensor: selectedSensor });

    }

    mySocket.on('disconnect', function () {
        console.log('WS client disconnect!');
    });

    mySocket.on(changeUpdatePeriodEventName, function (updatePeriod) {
        console.log('updatePeriod.value: ' + updatePeriod.value);
        if (periodMap[updatePeriod.value] !== undefined) {
            nextSensorUpdateTimePeriod_ms = periodMap[updatePeriod.value];
            mySocket.emit(showUpdatePeriodsEventName, { current: getKeyByValue(periodMap, sensorUpdateTimePeriod_ms), next: updatePeriod.value });
        }
        console.log('update period [ms]: ' + periodMap[updatePeriod.value]);
    });

    mySocket.on(sensorChangedEventName, function (sensorId) {
        selectedSensor = sensorId;
        console.log('sensor changed by client. Id: ' + sensorId);
        //plotData(dataInFile);
    });
});

//https://stackoverflow.com/a/28191966/51358
function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}


function pad(num) {
    const size = 2;
    var s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
}

function getCurrentDateTime() {
    var date = new Date();

    var sec = date.getSeconds();
    var min = date.getMinutes();
    var modifiedHour = date.getHours() + 3;
    var hour = (modifiedHour) % 24; //My server time is 3 hours behind Turkey time

    var day = modifiedHour < 24 ? date.getDate() : date.getDate() + 1; //day of month. if you use getDay(), it will return day of week
    var modifiedMonth = day <= daysInMonth(date.getFullYear(), date.getMonth() + 1) ? date.getMonth() + 1 : date.getMonth() + 2; //January = 0
    var month = modifiedMonth < 13 ? modifiedMonth : 1;
    var year = modifiedMonth < 13 ? date.getFullYear() : date.getFullYear() + 1;

    return year + '-' + pad(month) + '-' + pad(day) + ' ' + pad(hour) + ':' + pad(min) + ':' + pad(sec); //plotly format
}

function daysInMonth(month, year) { // Use 1 for January, 2 for February, etc. https://stackoverflow.com/a/315767/51358
    return new Date(year, month, 0).getDate();
}

function appendToFile(dataFromClient) {// data from client is of the form "25.12, 33.78"
    //TODO What to do when file gets too large (>10 MB) --> Use database instead of text file  
    console.log(dataFromClient);
    var s = dataFromClient.split(',');
    try {
        var temperatureFromClient = parseFloat(s[0].trim());
        var humidityFromClient = parseFloat(s[1].trim());
        var pressureFromClient = NaN;
        if (s.length == 3) {//pressure exists in dataFromClient
            pressureFromClient = parseFloat(s[2].trim()) / 1000;
        }
        lastSensorDataArrivalTime = getCurrentDateTime(); //parsing successful, update data arrival time
        mySocket.emit(lastDataFromServerEventName, lastSensorDataArrivalTime + ", Temp [" + String.fromCharCode(176) + "C], Humid[%], Pres [kPa] = " + temperatureFromClient + ", " + humidityFromClient +
            ", " + pressureFromClient);
        if (fs.existsSync(dataFileName)) {
            fs.readFile(dataFileName, 'utf8', function readFileCallback(err, dataInFile) {
                if (err) {
                    console.log(err);
                } else {
                    var dataInServer = JSON.parse(dataInFile);
                    //var newX = dataInServer.temperature.x.slice(-1)[0] + 1; //increment x
                    var newX = lastSensorDataArrivalTime;
                    dataInServer.temperature.x.push(newX);
                    dataInServer.temperature.y.push(temperatureFromClient);

                    dataInServer.humidity.x.push(newX);
                    dataInServer.humidity.y.push(humidityFromClient);

                    dataInServer.pressure.x.push(newX);
                    dataInServer.pressure.y.push(pressureFromClient);

                    json = JSON.stringify(dataInServer); //convert it back to json
                    fs.writeFile(dataFileName, json, 'utf8', function (err, data) {
                        if (err) {
                            console.log(err);
                        } else {
                            mySocket.emit(plotDataFromServerEventName, dataInServer);
                        }
                    });
                }
            });
        } else {
            var dataInServer = {
                temperature: {
                    x: [lastSensorDataArrivalTime],
                    y: [temperatureFromClient],
                    name: 'T [C]'
                },
                humidity: {
                    x: [lastSensorDataArrivalTime],
                    y: [humidityFromClient],
                    name: 'H [%]'
                },
                pressure: {
                    x: [lastSensorDataArrivalTime],
                    y: [pressureFromClient],
                    name: 'P [kPa]'
                }
            }
            var json = JSON.stringify(dataInServer);
            fs.writeFile(dataFileName, json, 'utf8', function (err, data) {
                if (err) {
                    console.log(err);
                } else {
                    mySocket.emit(plotDataFromServerEventName, dataInServer);
                }
            });
        }
    } catch (err) {
        console.log('Error while trying to parse "' + dataFromClient + '" and append to file. Message: ' + err);
        mySocket.emit(lastDataFromServerEventName, getCurrentDateTime() + '<br>Wrong data format!<br>Sent data: "<span style="color: #ff0000">' + dataFromClient +
            '</span>"<br>Data should be of the format "<span style="color: #0000ff">number1, number2</span>"');
    }
}

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
