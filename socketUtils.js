var fs = require('fs');
const util = require('./utilities.js');
const nbOfDigits = 1;
const updatePeriodOneHour = '1hr';
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
    sensors: ["Samil", "Murat", "Samil_BME280"],
    updateTimePeriods_ms: [3600 * 1000, 3600 * 1000, 3600 * 1000],
    nextUpdateTimePeriods_ms: [3600 * 1000, 3600 * 1000, 3600 * 1000]
};

var defaultSelectedSensorID = sensorList.sensors[1];

module.exports = {
    //variables and constants:
    plotDataFromServerEventName: plotDataFromServerEventName,
    lastDataFromServerEventName: lastDataFromServerEventName,
    showUpdatePeriodsEventName: showUpdatePeriodsEventName,
    updatePeriodOneHour: updatePeriodOneHour,
    periodMap: periodMap,
    sensorList: sensorList,
    defaultSelectedSensorID: defaultSelectedSensorID,
    //functions:
    appendSensorDataToFile: appendSensorDataToFile,
    plotSensorData: plotSensorData,
    changeUpdatePeriodForUserSelectedSensor: changeUpdatePeriodForUserSelectedSensor,
    getUpdateTimePeriodsForSensor_ms: getUpdateTimePeriodsForSensor_ms
}

function changeUpdatePeriodForUserSelectedSensor(mySocket, sensorID, updatePeriod) {
    console.log('changeUpdatePeriodForUserSelectedSensor() new updatePeriod.value: ' + updatePeriod.value);
    if (periodMap[updatePeriod.value] !== undefined) {
        sensorList.nextUpdateTimePeriods_ms[getSensorIndex(sensorID)] = periodMap[updatePeriod.value];
        updateTimePeriodsInFile(sensorID);
        mySocket.emit(showUpdatePeriodsEventName, {
            current: util.getKeyByValue(periodMap, sensorList.updateTimePeriods_ms[getSensorIndex(sensorID)]),
            next: updatePeriod.value
        });
    }
    console.log('changeUpdatePeriodForUserSelectedSensor() update period [ms]: ' + periodMap[updatePeriod.value]);
}

function plotSensorData(mySocket, sensorID) {
    console.log('plotSensorData() sensorID sent by client: ' + sensorID);
    var dataInServer = { //default data to be used in case data file does not exist yet
        updateTimePeriod: {
            current: "1hr",
            next: "1hr"
        },
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
    const dataFileName = util.getSensorDataFileName(sensorID);
    if (fs.existsSync(dataFileName)) {
        fs.readFile(dataFileName, 'utf8', function readFileCallback(err, dataInFile) { //async file reading
            if (err) {
                console.log(err);
            } else {
                console.log("plotSensorData() " + dataFileName + " read.");
                dataInServer = JSON.parse(dataInFile);
                //Update string in html:
                const lastDataArrivalTime = dataInServer.temperature.x[dataInServer.temperature.x.length - 1];
                const lastData = lastDataArrivalTime + ", Temp [" + String.fromCharCode(176) + "C], Humid[%], Pres [kPa] = "
                    + dataInServer.temperature.y[dataInServer.temperature.y.length - 1].toFixed(nbOfDigits) +
                    ", " + dataInServer.humidity.y[dataInServer.humidity.y.length - 1].toFixed(nbOfDigits) +
                    ", " + dataInServer.pressure.y[dataInServer.pressure.y.length - 1].toFixed(nbOfDigits);
                mySocket.emit(lastDataFromServerEventName, lastData);
                //Update plot in html:
                mySocket.emit(plotDataFromServerEventName, { dataInServer, selectedSensor: sensorID });
                mySocket.emit(updateSensorRadioButtonsEventName, { sensorList, selectedSensor: sensorID });
                mySocket.emit(showUpdatePeriodsEventName, {
                    current: dataInServer.updateTimePeriod.current,
                    next: dataInServer.updateTimePeriod.next
                });
            }
        });
    } else { //no data exists
        console.log("plotSensorData() no data file for sensorID " + sensorID);
        mySocket.emit(lastDataFromServerEventName, "Awaiting data...");
        mySocket.emit(plotDataFromServerEventName, { dataInServer, selectedSensor: sensorID }); //update plot in HTML with default data
        mySocket.emit(updateSensorRadioButtonsEventName, { sensorList, selectedSensor: sensorID });
    }
}

function appendSensorDataToFile(dataFromSensor, res, callback) {// data from sensor is of the form "10,20,30,Samil"
    //TODO What to do when file gets too large (>10 MB) --> Use database instead of text file  
    var s = dataFromSensor.split(',');
    try {
        var temperatureFromClient_C = parseFloat(s[0].trim());
        var humidityFromClient_percent = parseFloat(s[1].trim());
        var pressureFromClient_kPa = parseFloat(s[2].trim()) / 1000;
        var sensorIDFromClient;
        var activeSensorID = sensorList.sensors[1]; //default sensor
        if (s.length == 4) {//sensor id exists in dataFromClient
            sensorIDFromClient = s[3].trim();
            if (sensorList.sensors.findIndex(x => x === sensorIDFromClient) >= 0) {//sensor id exists in sensor list
                activeSensorID = sensorIDFromClient;
            }
        }
        console.log('appendSensorDataToFile() activeSensorID ' + activeSensorID + ' used to write to file.');
        const lastDataArrivalTime = util.getCurrentDateTime(); //parsing successful, update data arrival time
        const dataFileName = util.getSensorDataFileName(activeSensorID);
        const iSensor = getSensorIndex(activeSensorID);
        sensorList.updateTimePeriods_ms[iSensor] = sensorList.nextUpdateTimePeriods_ms[iSensor]; //on sensor data post, current = next
        if (fs.existsSync(dataFileName)) {
            fs.readFile(dataFileName, 'utf8', function readFileCallback(err, dataInFile) {
                if (err) {
                    console.log(err);
                } else {
                    var dataInServer = JSON.parse(dataInFile);
                    console.log("appendSensorDataToFile() iSensor: " + iSensor + ", dataInServer.updateTimePeriod.current: " + dataInServer.updateTimePeriod.current + ", t_ms: " + sensorList.updateTimePeriods_ms[iSensor]);

                    console.log("appendSensorDataToFile() current: " + util.getKeyByValue(periodMap, sensorList.updateTimePeriods_ms[iSensor]));
                    console.log("appendSensorDataToFile() next   : " + util.getKeyByValue(periodMap, sensorList.nextUpdateTimePeriods_ms[iSensor]));
                    dataInServer.updateTimePeriod.current = util.getKeyByValue(periodMap, sensorList.updateTimePeriods_ms[iSensor]);
                    dataInServer.updateTimePeriod.next = util.getKeyByValue(periodMap, sensorList.nextUpdateTimePeriods_ms[iSensor]);
                    
                    //var newX = dataInServer.temperature.x.slice(-1)[0] + 1; //increment x
                    var newX = lastDataArrivalTime;
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
                            console.log("appendSensorDataToFile() Writing of data to " + dataFileName + " finished.")
                            callback(dataFromSensor, res);
                        }
                    });
                }
            });
        } else {// data file does not exist for sensor that sent data to server
            var dataInServer = {
                updateTimePeriod: {
                    current: util.getKeyByValue(periodMap, sensorList.updateTimePeriods_ms[iSensor]),
                    next: util.getKeyByValue(periodMap, sensorList.nextUpdateTimePeriods_ms[iSensor])
                },
                temperature: {
                    x: [lastDataArrivalTime],
                    y: [temperatureFromClient_C],
                    name: 'T [C]'
                },
                humidity: {
                    x: [lastDataArrivalTime],
                    y: [humidityFromClient_percent],
                    name: 'H [%]'
                },
                pressure: {
                    x: [lastDataArrivalTime],
                    y: [pressureFromClient_kPa],
                    name: 'P [kPa]'
                }
            }
            var json = JSON.stringify(dataInServer);
            fs.writeFile(dataFileName, json, 'utf8', function (err, data) {
                if (err) {
                    console.log(err);
                } else {
                    callback(dataFromSensor, res);
                }
            });
        }
    } catch (err) {
        console.log('appendSensorDataToFile() Error while trying to parse "' + dataFromSensor + '" and append to file. Message: ' + err);
    }
}

function getUpdateTimePeriodsForSensor_ms(sensorID) {
    return sensorList.updateTimePeriods_ms[getSensorIndex(sensorID)];
}

function updateTimePeriodsInFile(sensorID) {
    const dataFileName = util.getSensorDataFileName(sensorID);
    if (fs.existsSync(dataFileName)) {
        fs.readFile(dataFileName, 'utf8', function readFileCallback(err, dataInFile) {
            if (err) {
                console.log(err);
            } else {
                var dataInServer = JSON.parse(dataInFile);
                const iSensor = getSensorIndex(sensorID);
                dataInServer.updateTimePeriod.current = util.getKeyByValue(periodMap, sensorList.updateTimePeriods_ms[iSensor]);
                dataInServer.updateTimePeriod.next = util.getKeyByValue(periodMap, sensorList.nextUpdateTimePeriods_ms[iSensor]);
                console.log("updateTimePeriodsInFile() Updating time periods in " + dataFileName +", current: " + dataInServer.updateTimePeriod.current + ", next: " + dataInServer.updateTimePeriod.next);
                json = JSON.stringify(dataInServer); //convert it back to json
                fs.writeFile(dataFileName, json, 'utf8', function (err, data) {
                    if (err) {
                        console.log(err);
                    }
                });
            }
        });
    }
}

function getSensorIndex(sensorID) {
    return sensorList.sensors.findIndex(x => x === sensorID);
}
