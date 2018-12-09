var fs = require("fs");

module.exports = function () {
    var defaultconf = {
        "database": {
            "type": "",
            "host": "",
            "user": "",
            "password": "",
            "db": ""
        },
        "logo": "static/PB.svg",
        "port": 8080
    };
    var userconf = JSON.parse(fs.readFileSync("./config.json"));
    return Object.assign(defaultconf, userconf);
};