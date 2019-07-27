var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var { async, needsPermission } = require("../common");
var { provePermission } = require("../permissions");

router.get(vroot + "issues/:issue", function (req, res) {
    res.redirect(vroot + "issues/" + req.params.issue + "/posts");
});
router.get(vroot + "issues/:issue/posts", needsPermission("issues.view.posts"), async(async function (req, res, next) {
    if (typeof req.params.issue !== typeof "") {
        req.logger.log("debug", "issue id of incorrect type");
        res.redirect(vroot);
    } else if (isNaN(Number(req.params.issue))) {
        req.logger.log("debug", "issue id is not identifier");
        res.redirect(vroot);
    } else {
        req.logger.log("debug", "issue request for issue %s", req.params.issue);
        var issues = await connection
            .select("issues.*", "users.fullname", "projects.shortprojectid")
            .from("issues")
            .leftJoin("projects", "issues.projectid", "projects.id")
            .leftJoin("users", "issues.assigneeid", "users.id")
            .where({
                "issues.id": Number(req.params.issue)
            });

        if (issues.length < 1) {
            req.logger.log("debug", "issue %s not found", req.params.issue);
            res.status(404).render("errors/404");
            return;
        }

        req.logger.log("debug", "successfully retrieved issue");
        var posts = await connection
            .select("issueposts.*", "users.fullname")
            .from("issueposts")
            .leftJoin("users", "issueposts.authorid", "users.id")
            .where({
                "issueposts.issueid": issues[0].id
            })
            .orderBy("issueposts.id", "asc");

        req.logger.log("debug", "successfully retrieved issue posts");
        var users = await connection
            .select("id", "fullname")
            .from("users");

        req.logger.log("debug", "successfully retrieved users");
        var files = await connection
            .select("fileid", "filename")
            .from("issuefiles")
            .where({
                "issueid": issues[0].id
            });

        req.logger.log("debug", "successfully retrieved issuefiles");
        res.render("issues/viewtalk", {
            issue: issues[0],
            things: posts,
            users: users,
            files: files,
            canopen: (req.user.id === issues[0].assigneeid && provePermission(req.user.permissions, "issues.changestatus.own")) ||
                provePermission(req.user.permissions, "issues.changestatus.other"),
            canedit: (issues[0].authorid === req.user.id && provePermission(req.user.permissions, "issues.edit.own")) ||
                provePermission(req.user.permissions, "issues.edit.other"),
            candelete: provePermission(req.user.permissions, "issues.remove"),
            canpost: provePermission(req.user.permissions, "issues.post"),
            caneditownpost: provePermission(req.user.permissions, "issues.editpost.own"),
            caneditotherpost: provePermission(req.user.permissions, "issues.editpost.other")
        });
    }
}));

module.exports = router;
