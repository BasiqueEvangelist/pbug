var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var diff = require("diff");
var { async, needsPermission } = require("../common");
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
        .select("issues.id", "issues.issuename", "projects.shortprojectid", "issues.isclosed", "issues.assigneeid", "issues.issuetags", "users.fullname")
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
    var users = await connection
        .select("id", "fullname")
        .from("users");
    req.logger.log("debug", "successfully retrieved users");

    var activities = (await connection
        .select("issueactivities.id", "dateofoccurance",
            "issueid", "authorid",
            "data", "users.fullname")
        .from("issueactivities")
        .leftJoin("users", "issueactivities.authorid", "users.id")
        .where({
            "issueid": req.params.issue
        })
        .orderBy("issueactivities.id", "asc")).map(function (a) {
            a.data = JSON.parse(a.data);
            return a;
        });
    req.logger.log("debug", "successfully retrieved activity");


    var pactivities = activities.map(function (t) {
        if (t.data.type === "editpost" || t.data.type === "editissue") {
            t.oldtext = [];
            t.newtext = [];
            var da = diff.diffLines(t.data.from.text, t.data.to.text);
            da.forEach(function (d, i) {
                if (typeof d.added === typeof undefined) d.added = false;
                if (typeof d.removed === typeof undefined) d.removed = false;
                if (!d.removed && !d.added) {
                    t.oldtext.push([d.value, ""]);
                    t.newtext.push([d.value, ""]);
                }
                else if (d.removed) {
                    t.oldtext.push([d.value, "red"]);
                    if (i === da.length - 1)
                        t.newtext.push([" ", "filler"]);
                    else {
                        if (!da[i + 1].added)
                            t.newtext.push([" ", "filler"]);
                    }
                }
                else {
                    if (i === 0)
                        t.oldtext.push([" ", "filler"]);
                    else {
                        if (!da[i - 1].removed)
                            t.oldtext.push([" ", "filler"]);
                    }
                    t.newtext.push([d.value, "green"]);
                }
            });
            if (t.data.to.assigneeid !== "-1")
                t.newassigneename = users.find((user) => user.id === parseInt(t.data.to.assigneeid)).fullname;
            return t;
        }
        else {
            return t;
        }
    });
    res.render("issues/viewactivity", {
        issue: issues[0],
        things: pactivities,
        users: users,
        canopen: req.user.id === -1 ? false : (req.user.id === issues[0].assigneeid && await provePermission(req.user.role, "issues.changestatus.own")) ||
            await provePermission(req.user.role, "issues.changestatus.other"),
        canedit: req.user.id === -1 ? false : (issues[0].authorid === req.user.id && await provePermission(req.user.role, "issues.edit.own")) ||
            await provePermission(req.user.role, "issues.edit.other"),
        candelete: req.user.id === -1 ? false : await provePermission(req.user.role, "issues.remove")
    });
}));

module.exports = router;
