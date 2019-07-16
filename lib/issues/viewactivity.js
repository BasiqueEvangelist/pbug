var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");

router.get(vroot + "issues/:issue/activity", async function (req, res, next) {
    if (typeof req.params.issue !== typeof "") {
        debug.issueapi("issue id of incorrect type");
        res.redirect(vroot);
    } else if (isNaN(Number(req.params.issue))) {
        debug.issueapi("issue id is not identifier");
        res.redirect(vroot);
    } else {
        debug.issueapi("issue request for issue %s", req.params.issue);
        var issues = await connection
            .select("issues.id", "issues.issuename", "projects.shortprojectid", "issues.isclosed", "issues.assigneeid", "issues.issuetags", "users.fullname")
            .from("issues")
            .leftJoin("projects", "issues.projectid", "projects.id")
            .leftJoin("users", "issues.assigneeid", "users.id")
            .where({
                "issues.id": Number(req.params.issue)
            });
        if (issues.length < 1) {
            debug.issueapi("issue %s not found", req.params.issue);
            res.status(404).render("errors/404");
        } else {
            debug.issueapi("successfully retrieved issue");
            var users = await connection
                .select("id", "fullname")
                .from("users");
            debug.issueapi("successfully retrieved users");
            var activities = (await connection
                .select("issueactivities.id", "dateofoccurance",
                    "issueid", "authorid",
                    "data", "users.fullname")
                .from("issueactivities")
                .leftJoin("users", "issueactivities.authorid", "users.id")
                .where({
                    "issueid": req.params.issue
                })
                .orderBy("id", "asc")).map(function (a) {
                    a.data = JSON.parse(a.data);
                    return a;
                });
            debug.issueapi("successfully retrieved activity");
            var pactivities = await Promise.all(activities.map(async function (t) {
                if (t.data.type === "assign") {
                    var oldfns = connection
                        .select("fullname")
                        .from("users")
                        .where({ id: t.data.oldassigneeid });
                    var newfns = connection
                        .select("fullname")
                        .from("users")
                        .where({ id: t.data.newassigneeid })
                    var newt = t;
                    if (oldfns.length === 1)
                        newt.oldfn = oldfns[0].fullname;
                    if (newfns.length === 1)
                        newt.newfn = newfns[0].fullname;
                    return newt;
                }
                else if (t.data.type === "editpost" || t.data.type === "editissue") {
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
                    return t;
                }
                else {
                    return t;
                }
            }));
            res.render("issues/viewactivity", {
                issue: issues[0],
                things: pactivities,
                users: users
            });
        }
    }
});

module.exports = router;