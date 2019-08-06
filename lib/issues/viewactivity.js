var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var { async, needsPermission } = require("../common");
var { processActivities } = require("./common");
var { provePermission } = require("../permissions");

router.get(vroot + "issues/:issue/activity", needsPermission("issues.view.activity"), async(async function (req, res, next) {
    if (typeof req.params.issue !== typeof "") {
        req.logger.log("debug", "issue id of incorrect type");
        res.redirect(vroot);
        return;
    }
    if (isNaN(Number(req.params.issue))) {
        req.logger.log("debug", "issue id is not identifier");
        res.redirect(vroot);
        return;
    }

    req.logger.log("debug", "issue request for issue %s", req.params.issue);
    var issues = await connection
        .select("issues.id", "issues.issuename", "projects.shortprojectid", "issues.isclosed",
            "issues.assigneeid", "issues.issuetags", "authors.fullname as authorname",
            "assignees.fullname as assigneename", "issues.authorid", "issues.assigneeid")
        .from("issues")
        .leftJoin("projects", "issues.projectid", "projects.id")
        .leftJoin("users as authors", "issues.authorid", "authors.id")
        .leftJoin("users as assignees", "issues.assigneeid", "assignees.id")
        .where({
            "issues.id": Number(req.params.issue)
        });
    if (issues.length < 1) {
        req.logger.log("debug", "issue %s not found", req.params.issue);
        res.status(404).render("errors/404");
        return;
    }

    req.logger.log("debug", "successfully retrieved issue");

    var activities = await processActivities(req.params.issue);

    res.render("issues/viewactivity", {
        issue: issues[0],
        things: activities,
        canopen: (req.user.id === issues[0].assigneeid && provePermission(req.user.permissions, "issues.changestatus.own")) ||
            provePermission(req.user.permissions, "issues.changestatus.other"),
        canedit: (issues[0].authorid === req.user.id && provePermission(req.user.permissions, "issues.edit.own")) ||
            provePermission(req.user.permissions, "issues.edit.other"),
        candelete: provePermission(req.user.permissions, "issues.remove")
    });
}));

module.exports = router;
