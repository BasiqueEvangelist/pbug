var winston = require("winston");
var log = winston.createLogger({
    transports: [
        new winston.transports.Console()
    ],
    format: winston.format.combine(
        winston.format.splat(),
        winston.format.timestamp(),
        winston.format.simple()
    ),
    level: process.env.NODE_ENV === "production" ? "info" : "debug"
});
exports.main = log;
exports.dbLogger = log.child({ "from": "db" });
exports.makeRequestLogger = function (id) {
    return log.child({ requestid: id });
};