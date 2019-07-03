var express = require("express");
var router = new express.Router();
var connection = require("./knexfile");
var config = require("./config.js");
var vroot = config["virtual-root"];
var debug = require("./debug");

router.get(vroot, async function (req, res, next) {
    if (req.user.id === -1) {
        debug.issueapi("showing all open issues");
        var results = await connection
            .select({
                "id": "issues.id",
                "issuename": "issues.issuename",
                "isclosed": "issues.isclosed",
                "shortprojectid": "projects.shortprojectid",
                "assigneename": "users.fullname"
            })
            .from("issues")
            .leftJoin("projects", "issues.projectid", "projects.id")
            .leftJoin("users", "issues.assigneeid", "users.id")
            .where({
                "issues.isclosed": false
            })
            .orderBy("issues.id", "desc")
        debug.issueapi("issues retrieved, sending body");
        res.render("issues/listall", {
            issues: results,
            title: "List of open issues"
        });
    } else {
        debug.issueapi("showing all open issues assigned to %s", req.user.username);
        var results = await connection
            .select({
                "id": "issues.id",
                "issuename": "issues.issuename",
                "isclosed": "issues.isclosed",
                "shortprojectid": "projects.shortprojectid",
                "assigneename": "users.fullname"
            })
            .from("issues")
            .leftJoin("projects", "issues.projectid", "projects.id")
            .leftJoin("users", "issues.assigneeid", "users.id")
            .where({
                "issues.isclosed": false,
                "issues.assigneeid": req.user.id
            })
            .orderBy("issues.id", "desc")
            .limit(50);
        debug.issueapi("retrieving issues authored by user");
        var aresults = await connection
            .select({
                "id": "issues.id",
                "issuename": "issues.issuename",
                "isclosed": "issues.isclosed",
                "shortprojectid": "projects.shortprojectid",
                "assigneename": "users.fullname"
            })
            .from("issues")
            .leftJoin("projects", "issues.projectid", "projects.id")
            .leftJoin("users", "issues.assigneeid", "users.id")
            .where({
                "issues.isclosed": false,
                "issues.authorid": req.user.id
            })
            .orderBy("issues.id", "desc")
            .limit(50);
        debug.issueapi("issues retrieved, sending body");
        res.render("issues/listall", {
            issues: results,
            aissues: aresults,
            title: "List of open issues assigned to you"
        });
    }
});

module.exports = router;
