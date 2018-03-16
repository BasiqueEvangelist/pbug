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
            query: function () {
                var topargs = arguments;
                if (arguments.length === 3)
                    debug("performing query \"%s\" with params %o", arguments[0], arguments[1]);
                else
                    debug("performing query \"%s\"", arguments[0]);
                conn.query(arguments[0], arguments.length === 3 ? arguments[1] : [], function (err) {
                    if (err) {
                        debug("query error: %o", err);
                    }
                    (topargs.length === 3 ? topargs[2] : topargs[1]).apply(this, arguments);
                });
            }
        };
    }
    // else if (type === "postgresql") {
    //     var conn = new pg.Client({
    //         host: host,
    //         user: user,
    //         password: pass,
    //         database: db
    //     });
    //     conn.connect();
    //     return {
    //         query: function () {
    //             var topargs = arguments;
    //             if (arguments.length === 3)
    //                 debug("performing query \"%s\" with params %o", arguments[0], arguments[1]);
    //             else
    //                 debug("performing query \"%s\"", arguments[0]);
    //             conn.query(arguments[0], arguments.length === 3 ? arguments[1] : [], function (err) {
    //                 if (err) {
    //                     debug("query error: %o", err);
    //                 }
    //                 (topargs.length === 3 ? topargs[2] : topargs[1]).apply(this, arguments);
    //             });
    //         }
    //     };
    // }
    else {
        throw new Error("Database " + type + " not supported");
    }
};