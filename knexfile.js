var Knex = require("knex");
var fs = require("fs");
var config = require("./config")();
module.exports = new Knex({
    client: config.database.type,
    connection: {
        host: config.database.host,
        user: config.database.user,
        password: config.database.password,
        database: config.database.db
    }
});