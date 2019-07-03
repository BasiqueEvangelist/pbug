var debug = {};
debug.all = require("debug")("pbug*");
debug.request = require("debug")("pbug:request");
debug.userapi = require("debug")("pbug:userapi");
debug.issueapi = require("debug")("pbug:issueapi");
debug.kbapi = require("debug")("pbug:kbapi");
module.exports = debug;
