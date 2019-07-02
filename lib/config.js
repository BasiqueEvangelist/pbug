var fs = require("fs");
var dbg = require("debug")("pbug:config");

var savedconfig = null;

function makeconfig() {
    if (savedconfig !== null) return savedconfig;
    var defaultconf = `{
        "database": {
            "client": "",
            "connection": {}
        },
        "features": {
            "files":false,
            "non-admin-infopages":false
        },
        "login": {
            "allowregistration": \"open\"
        },
        "design": {
            "logo": "static/PB.svg"
        },
        "port": 8080,
        "extends": "none",
        "include": [],
        "virtual-root":""
    }`;
    function getuserconf(path, prevs) {
        if (prevs.includes(path))
            return {};
        dbg("loading config %s", path);
        var userconf = JSON.parse(fs.readFileSync(path));
        if (typeof userconf.extends === "undefined") {
            userconf.extends = "none";
        }
        if (userconf.extends === "default") {
            dbg("config has default superconfig");
            userconf = Object.assign(JSON.parse(defaultconf), userconf);
        }
        else if (userconf.extends === "none") {
            dbg("config has no superconfig");
        }
        else {
            dbg("config has superconfig %s", userconf.extends);
            var nprevs = prevs;
            nprevs.push(path);
            userconf = Object.assign(getuserconf(userconf.extends, nprevs), userconf);
        }
        if (typeof userconf.include === "undefined") {
            userconf.include = [];
        }
        userconf.include.forEach(e => {
            dbg("config has config %s included", e);
            var nprevs = prevs;
            nprevs.push(path);
            userconf = Object.assign(userconf, getuserconf(e, nprevs));
        });
        delete userconf.extends;
        delete userconf.include;
        return userconf;
    }
    savedconfig = getuserconf("./config.json", []);
    return savedconfig;
};

module.exports = makeconfig();
