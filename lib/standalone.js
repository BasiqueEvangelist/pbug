var debug = require("./debug");
debug.main.info("starting pbug");
var http = require("http");
var pbug = require("./index");
var config = require("./config");
var port = Number(process.env.PBUG_PORT || process.env.PORT || config.port);

var srv = http.createServer();

function end() {
    debug.main.log("info", "stopping pbug");
    srv.close();
    debug.main.log("info", "stopped, exiting");
    process.exit(0);
}

process.on("SIGTERM", end);
process.on("SIGINT", end);

srv.on("request", pbug);

srv.listen({
    port: port
}, function (err) {
    if (err)
        debug.main.log("error", "error on bind: %s", err);
    else
        debug.main.log("info", "listening on " + port);
});
