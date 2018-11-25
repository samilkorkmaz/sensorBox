var fs = require('fs');
const util = require('./utilities.js');

const periodMap = {
    '10s': 10 * 1000,
    '10min': 10 * 60 * 1000,
    '1hr': 1 * 60 * 60 * 1000,
    '3hr': 3 * 60 * 60 * 1000
}
const updateSensorRadioButtonsEventName = 'updateSensorRadioButtons';
const plotDataFromServerEventName = 'plotDataFromServer';
const lastDataFromServerEventName = 'lastDataFromServer';
const showUpdatePeriodsEventName = 'showUpdatePeriods';

var sensorList = {
    sensors: ["Samil", "Murat"],
    updateTimePeriods_ms: [3600 * 1000, 3600 * 1000],
    nextUpdateTimePeriods_ms: [3600 * 1000, 3600 * 1000],
    lastDataArrivalTime: [undefined, undefined]
};

var selectedSensor = sensorList.sensors[1];

module.exports = {
    //variables and constants:
    plotDataFromServerEventName: plotDataFromServerEventName,
    lastDataFromServerEventName: lastDataFromServerEventName,
    showUpdatePeriodsEventName: showUpdatePeriodsEventName,
    periodMap: periodMap,
    sensorList: sensorList,
    selectedSensor: selectedSensor,
    getSelectedSensorIndex: getSelectedSensorIndex,
    getSensorIndex: getSensorIndex,
    //functions:
    appendToFile: appendToFile,
    plotSensorData: plotSensorData,
    updateFileAndPlot: updateFileAndPlot,
    changeUpdatePeriod: changeUpdatePeriod,
    showUpdatePeriods: showUpdatePeriods    
}

function showUpdatePeriods(mySocket) {
    mySocket.emit(showUpdatePeriodsEventName, {
        current: util.getKeyByValue(periodMap, sensorList.updateTimePeriods_ms[getSelectedSensorIndex()]),
        next: util.getKeyByValue(periodMap, sensorList.nextUpdateTimePeriods_ms[getSelectedSensorIndex()])
    });
}

function changeUpdatePeriod(mySocket, updatePeriod) {
    console.log('new updatePeriod.value: ' + updatePeriod.value);
        if (periodMap[updatePeriod.value] !== undefined) {
            sensorList.nextUpdateTimePeriods_ms[getSelectedSensorIndex()] = periodMap[updatePeriod.value];
            mySocket.emit(showUpdatePeriodsEventName, {
                current: util.getKeyByValue(periodMap, sensorList.updateTimePeriods_ms[getSelectedSensorIndex()]),
                next: updatePeriod.value
            });
        }
        console.log('update period [ms]: ' + periodMap[updatePeriod.value]);
}

function updateFileAndPlot(mySocket, body) {
    appendToFile(mySocket, body);
    sensorList.updateTimePeriods_ms[getSelectedSensorIndex()] = sensorList.nextUpdateTimePeriods_ms[getSelectedSensorIndex()];
            
}

function plotSensorData(mySocket, sensorID) {
    console.log('sensorID sent by client: ' + sensorID);
    selectedSensor = sensorID;
    mySocket.emit('showUpdatePeriods', {
        current: util.getKeyByValue(periodMap, sensorList.updateTimePeriods_ms[getSelectedSensorIndex()]),
        next: util.getKeyByValue(periodMap, sensorList.nextUpdateTimePeriods_ms[getSelectedSensorIndex()])
    });

    var dataInServer = {
        temperature: {
            x: [NaN],
            y: [NaN],
            name: 'T [C]'
        },
        humidity: {
            x: [NaN],
            y: [NaN],
            name: 'H [%]'
        },
        pressure: {
            x: [NaN],
            y: [NaN],
            name: 'P [kPa]'
        }
    }
    const dataFileName = util.getSensorDataFileName(selectedSensor);
    if (fs.existsSync(dataFileName)) {
        fs.readFile(dataFileName, 'utf8', function readFileCallback(err, dataInFile) { //async file reading
            if (err) {
                console.log(err);
            } else {
                dataInServer = JSON.parse(dataInFile);
                //Update string in html:
                var lastData = sensorList.lastDataArrivalTime[getSelectedSensorIndex()] + ", Temp [" + String.fromCharCode(176) + "C], Humid[%], Pres [kPa] = " + dataInServer.temperature.y[dataInServer.temperature.y.length - 1] +
                    ", " + dataInServer.humidity.y[dataInServer.humidity.y.length - 1] + ", " + dataInServer.pressure.y[dataInServer.pressure.y.length - 1];
                mySocket.emit(lastDataFromServerEventName, lastData);
                //Update plot in html:
                mySocket.emit(plotDataFromServerEventName, { dataInServer, selectedSensor: selectedSensor });
                mySocket.emit(updateSensorRadioButtonsEventName, { sensorList, selectedSensor: selectedSensor });
            }
        });
    } else {
        //Update plot in html:
        mySocket.emit(plotDataFromServerEventName, { dataInServer, selectedSensor: selectedSensor });
        mySocket.emit(updateSensorRadioButtonsEventName, { sensorList, selectedSensor: selectedSensor });
    }
}

function appendToFile(mySocket, dataFromClient) {// data from client is of the form "25.12, 33.78"
    //TODO What to do when file gets too large (>10 MB) --> Use database instead of text file  
    console.log(dataFromClient);
    var s = dataFromClient.split(',');
    try {
        var temperatureFromClient_C = parseFloat(s[0].trim());
        var humidityFromClient_percent = parseFloat(s[1].trim());
        var pressureFromClient_kPa = parseFloat(s[2].trim()) / 1000;
        var sensorIDFromClient;
        var sensorID = sensorList.sensors[1]; //default sensor
        if (s.length == 4) {//sensor id exists in dataFromClient
            sensorIDFromClient = s[3].trim();
            if (sensorList.sensors.findIndex(x => x === sensorIDFromClient) >= 0) {//sensor id exists in sensor list
                sensorID = sensorIDFromClient;
            }
        }
        console.log('sensorID ' + sensorID + ' used to write to file');
        sensorList.lastDataArrivalTime[getSensorIndex(sensorID)] = util.getCurrentDateTime(); //parsing successful, update data arrival time
        if (selectedSensor === sensorID) {
            mySocket.emit(lastDataFromServerEventName, sensorList.lastDataArrivalTime[getSelectedSensorIndex()] + ", Temp [" + String.fromCharCode(176) + "C], Humid[%], Pres [kPa] = " +
                temperatureFromClient_C + ", " + humidityFromClient_percent + ", " + pressureFromClient_kPa);
        }
        const dataFileName = util.getSensorDataFileName(sensorID);
        if (fs.existsSync(dataFileName)) {
            fs.readFile(dataFileName, 'utf8', function readFileCallback(err, dataInFile) {
                if (err) {
                    console.log(err);
                } else {
                    var dataInServer = JSON.parse(dataInFile);
                    //var newX = dataInServer.temperature.x.slice(-1)[0] + 1; //increment x
                    var newX = sensorList.lastDataArrivalTime[getSelectedSensorIndex()];
                    dataInServer.temperature.x.push(newX);
                    dataInServer.temperature.y.push(temperatureFromClient_C);

                    dataInServer.humidity.x.push(newX);
                    dataInServer.humidity.y.push(humidityFromClient_percent);

                    dataInServer.pressure.x.push(newX);
                    dataInServer.pressure.y.push(pressureFromClient_kPa);

                    json = JSON.stringify(dataInServer); //convert it back to json
                    fs.writeFile(dataFileName, json, 'utf8', function (err, data) {
                        if (err) {
                            console.log(err);
                        } else {
                            if (selectedSensor === sensorID) {
                                mySocket.emit(plotDataFromServerEventName, { dataInServer, selectedSensor: selectedSensor });
                            }
                        }
                    });
                }
            });
        } else {// data file does not exist for sensor that sent data to server
            var dataInServer = {
                temperature: {
                    x: [sensorList.lastDataArrivalTime[getSelectedSensorIndex()]],
                    y: [temperatureFromClient_C],
                    name: 'T [C]'
                },
                humidity: {
                    x: [sensorList.lastDataArrivalTime[getSelectedSensorIndex()]],
                    y: [humidityFromClient_percent],
                    name: 'H [%]'
                },
                pressure: {
                    x: [sensorList.lastDataArrivalTime[getSelectedSensorIndex()]],
                    y: [pressureFromClient_kPa],
                    name: 'P [kPa]'
                }
            }
            var json = JSON.stringify(dataInServer);
            fs.writeFile(dataFileName, json, 'utf8', function (err, data) {
                if (err) {
                    console.log(err);
                } else {
                    mySocket.emit(plotDataFromServerEventName, { dataInServer, selectedSensor: selectedSensor });
                }
            });
        }
    } catch (err) {
        console.log('Error while trying to parse "' + dataFromClient + '" and append to file. Message: ' + err);
        mySocket.emit(lastDataFromServerEventName, util.getCurrentDateTime() + '<br>Wrong data format!<br>Sent data: "<span style="color: #ff0000">' + dataFromClient +
            '</span>"<br>Data should be of the format "<span style="color: #0000ff">number1, number2</span>"');
    }
}

function getSelectedSensorIndex() {
    return sensorList.sensors.findIndex(x => x === selectedSensor);
}

function getSensorIndex(sensorID) {
    return sensorList.sensors.findIndex(x => x === sensorID);
}
