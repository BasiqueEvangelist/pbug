var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");

router.get(vroot + "issues/:issue", async function (req, res) {
    res.redirect(vroot + "issues/" + req.params.issue + "/posts");
});
router.get(vroot + "issues/:issue/posts", async function (req, res, next) {
    if (typeof req.params.issue !== typeof "") {
        debug.issueapi("issue id of incorrect type");
        res.redirect(vroot);
    } else if (isNaN(Number(req.params.issue))) {
        debug.issueapi("issue id is not identifier");
        res.redirect(vroot);
    } else {
        debug.issueapi("issue request for issue %s", req.params.issue);
        var issues = await connection
            .select("issues.*", "users.fullname", "projects.shortprojectid")
            .from("issues")
            .leftJoin("projects", "issues.projectid", "projects.id")
            .leftJoin("users", "issues.assigneeid", "users.id")
            .where({
                "issues.id": Number(req.params.issue)
            })

        if (issues.length < 1) {
            debug.issueapi("issue %s not found", req.params.issue);
            res.status(404).render("404");
            return;
        }

        debug.issueapi("successfully retrieved issue");
        var posts = await connection
            .select("issueposts.*", "users.fullname")
            .from("issueposts")
            .leftJoin("users", "issueposts.authorid", "users.id")
            .where({
                "issueposts.issueid": issues[0].id
            })
            .orderBy("issueposts.id", "asc");

        debug.issueapi("successfully retrieved issue posts");
        var users = await connection
            .select("id", "fullname")
            .from("users");

        debug.issueapi("successfully retrieved users");
        var files = await connection
            .select("fileid", "filename")
            .from("issuefiles")
            .where({
                "issueid": issues[0].id
            });

        debug.issueapi("successfully retrieved issuefiles");
        res.render("issues/viewtalk", {
            issue: issues[0],
            things: posts,
            users: users,
            files: files
        });
    }
});

module.exports = router;
