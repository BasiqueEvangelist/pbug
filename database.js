var mysql = require("mysql");
var pg = require("pg");
var debug = require("debug")("pbug:db");
module.exports = function (type, host, user, pass, db) {
    if (host === "") throw new Error("Empty host");
    else if (user === "") throw new Error("Empty user");
    else if (db === "") throw new Error("Empty db");
    if (type === "mysql") {
        var conn = new mysql.createConnection({
            host: host,
            user: user,
            password: pass,
            database: db
        });
        return {
            query: function (query, parameters, callback) {
                debug("performing query \"%s\" with params %o", query, parameters);
                conn.query(query, parameters, function (err) {
                    if (err) {
                        debug("query error: %o", err);
                    }
                    callback.apply(this, arguments);
                });
            }
        };
    }
    else if (type === "postgresql") {
        var conn = new pg.Client({
            host: host,
            user: user,
            password: pass,
            database: db
        });
        return {
            query: function (query, parameters, callback) {
                debug("performing query \"%s\" with params %o", query, parameters);
                conn.query(query, parameters, function (err) {
                    if (err) {
                        debug("query error: %o", err);
                    }
                    callback.apply(this, arguments);
                });
            }
        };
    }
    else {
        throw new Error("Database " + type + " not supported");
    }
};