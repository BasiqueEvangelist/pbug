var mysql = require("sync-mysql");
var fs = require("fs");
require("dotenv").config();
var connection = new mysql({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_DB
});
var dbob = JSON.parse(fs.readFileSync("dbdump.json"));
dbob.users.forEach(function (element) {
    connection.query("INSERT INTO Users VALUES (?,?,?,?,?,?,?)", [element.ID, element.Username, element.FullName, element.IsAdministrator, element.PasswordHash, element.PasswordSalt, element.APIKey]);
});
dbob.projects.forEach(function (element) {
    connection.query("INSERT INTO Projects VALUES (?,?,?,?)", [element.ID, element.ProjectName, element.ShortProjectID, element.AuthorID]);
});
dbob.issues.forEach(function (element) {
    connection.query("INSERT INTO Issues VALUES (?,?,?,?,?)", [element.ID, element.IssueName, element.ProjectID, element.IsClosed, element.AssigneeID]);
});
dbob.issueposts.forEach(function (element) {
    connection.query("INSERT INTO IssuePosts VALUES (?,?,?,?,?,?)", [element.ID, element.AuthorID, element.IssueID, element.ContainedText, element.DateOfCreation, element.DateOfEdit]);
});
dbob.issuetags.forEach(function (element) {
    connection.query("INSERT INTO IssueTags VALUES (?,?,?)", [element.ID, element.IssueID, element.TagText]);
});
dbob.sessions.forEach(function (element) {
    connection.query("INSERT INTO sessions VALUES (?,?,?)", [element.session_id, element.expires, element.data]);
});