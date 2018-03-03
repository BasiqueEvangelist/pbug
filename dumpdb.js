var mysql = require("mysql");
var fs = require("fs");
var connection = new mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB
});
var dbob = {};
dbob.users = [];
dbob.projects = [];
dbob.issues = [];
dbob.issueposts = [];
dbob.issuetags = [];
dbob.sessions = [];
connection.query("SELECT * FROM Users", function (err, results) {
    if (err) throw err;
    dbob.users = results;
    connection.query("SELECT * FROM Projects", function (err, results) {
        if (err) throw err;
        dbob.projects = results;
        connection.query("SELECT * FROM Issues", function (err, results) {
            if (err) throw err;
            dbob.issues = results;
            connection.query("SELECT * FROM IssuePosts", function (err, results) {
                if (err) throw err;
                dbob.issueposts = results;
                connection.query("SELECT * FROM IssueTags", function (err, results) {
                    if (err) throw err;
                    dbob.issuetags = results;
                    connection.query("SELECT * FROM sessions", function (err, results) {
                        if (err) throw err;
                        dbob.sessions = results;
                        fs.writeFileSync("dbdump.json", JSON.stringify(dbob));
                    });
                });
            });
        });
    });
});