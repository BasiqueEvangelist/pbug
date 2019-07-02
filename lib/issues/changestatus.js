var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var { insertActivity } = require("../common.js");
var debug = require("../debug");

router.get(vroot + "issues/:issue/open", async function (req, res, next) {
    if (typeof req.params.issue !== typeof "") {
        debug.issueapi("issue id of incorrect type");
        res.redirect(vroot);
    } else if (isNaN(Number(req.params.issue))) {
        debug.issueapi("issue id is not identifier");
        res.redirect(vroot);
    } else {
        debug.issueapi("open request for issue %s", req.params.issue);
        var results = await connection
            .select("assigneeid", "isclosed")
            .from("issues")
            .where({
                "id": req.params.issue
            });
        if (req.user.id === results[0].assigneeid || req.user.isadmin) {
            debug.issueapi("opening issue %s", req.params.issue);
            await connection("issues")
                .where({
                    "id": req.params.issue
                })
                .update({
                    "isclosed": false
                });
            await insertActivity(req.params.issue, req.user.id, {
                    type: "status",
                    newstatus: "open",
                    oldstatus: results.isclosed ? "closed" : "open"
            });
            debug.issueapi("successfully opened issue %s", req.params.issue);
            res.redirect(vroot + "issues/" + req.params.issue + "/posts");
        } else {
            res.status(403);
            debug.issueapi("user is not privileged enough to open issue");
        }
    }
});
router.get(vroot + "issues/:issue/close", async function (req, res, next) {
    if (typeof req.params.issue !== typeof "") {
        debug.issueapi("issue id of incorrect type");
        res.redirect(vroot);
    } else if (isNaN(Number(req.params.issue))) {
        debug.issueapi("issue id is not identifier");
        res.redirect(vroot);
    } else {
        debug.issueapi("close request for issue %s", req.params.issue);
        var results = await connection
            .select("assigneeid", "isclosed")
            .from("issues")
            .where({
                "id": req.params.issue
            })
        if (req.user.id === results[0].assigneeid || req.user.isadmin) {
            debug.issueapi("closing issue %s", req.params.issue);
            await connection("issues")
                .where({
                    "id": req.params.issue
                })
                .update({
                    "isclosed": true
                });
            await insertActivity(req.params.issue, req.user.id, {
                type: "status",
                newstatus: "closed",
                oldstatus: results[0].isclosed ? "closed" : "opened"
            });
            debug.issueapi("successfully closed issue %s", req.params.issue);
            res.redirect(vroot + "issues/" + req.params.issue + "/posts");
        } else {
            debug.issueapi("user is not privileged enough to close issue");
        }
    }
});

module.exports = router;
