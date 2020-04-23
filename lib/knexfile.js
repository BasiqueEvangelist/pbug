var Knex = require("knex");
var fs = require("fs");
var config = require("./config");
var log = require("./debug").dbLogger;
var dbobj = {};
Object.assign(dbobj, config.database);
Object.assign(dbobj, {
    log: {
        warn: log.warn,
        error: log.error,
        deprecate: log.warn,
        debug: log.debug
    }
});

module.exports = new Knex(dbobj);
