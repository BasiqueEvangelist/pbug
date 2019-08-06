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
    level: process.env.DEBUG | "info"
});
exports.main = log;
exports.makeRequestLogger = function (id) {
    return log.child({ requestid: id });
};