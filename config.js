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
        "login": {
            "allowregistration": true
        },
        "design": {
            "logo": "static/PB.svg",
        },
        "port": 8080,
        "extends": "default",
        "include": []
    };
    function getuserconf(path, prevs) {
        if (prevs.includes(path))
            return {};
        var userconf = JSON.parse(fs.readFileSync(path));
        if (typeof userconf.extends !== "undefined")
            if (userconf.extends !== "default") {
                var nprevs = prevs;
                nprevs.push(path);
                userconf = Object.assign(getuserconf(userconf.extends, nprevs), userconf);
            }
        if (typeof userconf.include !== "undefined") {
            userconf.include.forEach(e => {
                var nprevs = prevs;
                nprevs.push(path);
                userconf = Object.assign(userconf, getuserconf(e, nprevs));
            });
        }
        return userconf;
    }
    var userconf = getuserconf("./config.json", []);
    return Object.assign(defaultconf, userconf);
};