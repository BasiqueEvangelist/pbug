var debug = require("./debug");
debug.all("starting pbug");
var http = require("http");
var pbug = require("./index");
var config = require("./config");
var port = Number(process.env.PBUG_PORT || process.env.PORT || config.port);

var srv = http.createServer();

function end() {
    debug.all("stopping pbug");
    srv.close();
    debug.all("stopped, exiting");
    process.exit(0);
}

process.on("SIGTERM", end); 
process.on("SIGINT", end); 

srv.on("request", pbug);

srv.listen({
    port: port
}, function(err) {
    if (err)
        debug.all("error on bind: %s", err);
    else
        debug.all("listening on " + port);
});
