require("dotenv").config();
var connection = require("./lib/knexfile");
var debug = require("./lib/debug");
var { hashpassword, mksalt } = require("./lib/users/common");
async function schema() {
    await connection.schema
        .dropTableIfExists("sessions")
        .dropTableIfExists("issueposts")
        .dropTableIfExists("issuetags")
        .dropTableIfExists("issueactivities")
        .dropTableIfExists("issuefiles")
        .dropTableIfExists("issuewatchers")
        .dropTableIfExists("issues")
        .dropTableIfExists("projects")
        .dropTableIfExists("infopagecomments")
        .dropTableIfExists("infopages")
        .dropTableIfExists("invites")
        .dropTableIfExists("users")
        .dropTableIfExists("roles");
    debug.main.log("info", "Dropped tables");
    await connection.schema
        .createTable("roles", function (tbl) {
            tbl.increments("id");
            tbl.string("name", 100).notNullable().unique();
            tbl.text("permissions");
        });
    debug.main.log("info", "Created roles");
    await connection.schema
        .createTable("users", function (tbl) {
            tbl.increments("id");
            tbl.string("username", 64).notNullable().unique();
            tbl.string("fullname", 100).notNullable();
            tbl.string("passwordhash", 128);
            tbl.string("passwordsalt", 64).notNullable();
            tbl.integer("roleid").unsigned().references("id").inTable("roles");
            tbl.string("apikey", 128).notNullable().unique();
        });
    debug.main.log("info", "Created users");
    await connection.schema
        .createTable("projects", function (tbl) {
            tbl.increments("id");
            tbl.string("projectname", 100).notNullable();
            tbl.string("shortprojectid", 3).unique().notNullable();
            tbl.integer("authorid").unsigned().references("id").inTable("users");
        });
    debug.main.log("info", "Created projects");
    await connection.schema
        .createTable("issues", function (tbl) {
            tbl.increments("id");
            tbl.string("issuename", 100).notNullable();
            tbl.text("issuetags").notNullable().defaultTo("");
            tbl.integer("authorid").unsigned().references("id").inTable("users");
            tbl.integer("projectid").unsigned().references("id").inTable("projects").notNullable();
            tbl.boolean("isclosed").defaultTo(false);
            tbl.integer("assigneeid").unsigned().references("id").inTable("users");
            tbl.text("description").notNullable();
            tbl.dateTime("dateofcreation").notNullable();
        });
    debug.main.log("info", "Created issues");
    await connection.schema
        .createTable("issuewatchers", function (tbl) {
            tbl.increments("id");
            tbl.integer("watcherid").unsigned().references("id").inTable("users").notNullable();
            tbl.integer("issueid").unsigned().references("id").inTable("issues").notNullable();
        });
    debug.main.log("info", "Created issuewatchers");
    await connection.schema
        .createTable("issueposts", function (tbl) {
            tbl.increments("id");
            tbl.integer("authorid").unsigned().references("id").inTable("users");
            tbl.integer("issueid").unsigned().references("id").inTable("issues").notNullable();
            tbl.text("containedtext").notNullable();
            tbl.dateTime("dateofcreation").notNullable();
            tbl.dateTime("dateofedit");
        });
    debug.main.log("info", "Created issueposts");
    await connection.schema
        .createTable("issueactivities", function (tbl) {
            tbl.increments("id");
            tbl.dateTime("dateofoccurance");
            tbl.integer("issueid").unsigned().references("id").inTable("issues").notNullable();
            tbl.integer("authorid").unsigned().references("id").inTable("users");
            tbl.json("data");
        });
    debug.main.log("info", "Created issueactivities");
    await connection.schema
        .createTable("infopages", function (tbl) {
            tbl.increments("id");
            tbl.string("path", 200).unique().notNullable();
            tbl.dateTime("dateofcreation").notNullable();
            tbl.integer("secrecy", 255);
            tbl.text("pagetags").notNullable().defaultTo("");
            tbl.integer("authorid").unsigned().references("id").inTable("users");
            tbl.dateTime("dateofedit").notNullable();
            tbl.integer("editorid").unsigned().references("id").inTable("users");
            tbl.string("pagename", 100).notNullable();
            tbl.text("containedtext").notNullable();
        });
    debug.main.log("info", "Created infopages");
    await connection.schema
        .createTable("infopagecomments", function (tbl) {
            tbl.increments("id");
            tbl.dateTime("dateofcreation").notNullable();
            tbl.integer("authorid").unsigned().references("id").inTable("users");
            tbl.integer("infopageid").unsigned().references("id").inTable("infopages");
            tbl.dateTime("dateofedit");
            tbl.text("containedtext");
        });
    debug.main.log("info", "Created infopagecomments");
    await connection.schema
        .createTable("issuefiles", function (tbl) {
            tbl.increments("id");
            tbl.integer("issueid").unsigned().references("id").inTable("issues");
            tbl.string("filename", 100).notNullable();
            tbl.string("fileid", 128);
        });
    debug.main.log("info", "Created issuefiles");
    await connection.schema
        .createTable("invites", function (tbl) {
            tbl.increments("id");
            tbl.string("uid", 128).notNullable().unique();
            tbl.integer("roleid").unsigned().references("id").inTable("roles");
        });
    debug.main.log("info", "Created invites");
    await connection("roles")
        .insert({
            "name": "Anonymous",
            "permissions": ""
        });
    debug.main.log("info", "Added anonymous role");
    await connection("roles")
        .insert({
            "name": "Administrator",
            "permissions": "**"
        });
    debug.main.log("info", "Added admin role");
    var adminsalt = await mksalt();
    var adminpass = await mksalt();
    var adminhash = await hashpassword(adminpass, adminsalt);
    await connection("users")
        .insert({
            "username": "pbug",
            "fullname": "System",
            "passwordhash": adminhash,
            "passwordsalt": adminsalt,
            "apikey": "",
            "roleid": 2
        });
    debug.main.log("info", "Added admin user");
    return adminpass;
}
schema().then((password) => {
    debug.main.log("info", "Login with username pbug and password " + password);
    process.exit(0);
}).catch((err) => {
    debug.main.log("error", err);
    process.exit(0);
});