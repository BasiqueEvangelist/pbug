var Knex = require("knex");
var fs = require("fs");
var config = require("./config")();
var log = require("debug")("pbug:db");
var dbobj = {};
Object.assign(dbobj, config.database);
Object.assign(dbobj, {
    log: {
        warn: log,
        error: log,
        deprecate: log,
        debug(message) {}
    }
});

module.exports = new Knex(dbobj);
