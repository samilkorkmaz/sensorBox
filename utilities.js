module.exports = {
    pad: function (num) {
        return  pad(num);
    },

    //https://stackoverflow.com/a/28191966/51358
    getKeyByValue: function (object, value) {
        return Object.keys(object).find(key => object[key] === value);
    },

    getSensorDataFileName: function (sensorID) {
        const dataFileName = 'dataFor' + sensorID + '.json'; //Note: File name cannot contain Turkish characters.
        console.log(dataFileName);
        return dataFileName;
    },

    getCurrentDateTime: function () {
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

    
}

function daysInMonth(month, year) { // Use 1 for January, 2 for February, etc. https://stackoverflow.com/a/315767/51358
    return new Date(year, month, 0).getDate();
}

function pad(num) {
    const size = 2;
    var s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
}