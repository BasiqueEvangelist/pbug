var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var { insertActivity, async, permissionError } = require("../common.js");
var { provePermission } = require("../permissions");
var debug = require("../debug");

router.get(vroot + "issues/:issue/open", async(async function (req, res, next) {
    if (typeof req.params.issue !== typeof "") {
        req.logger.log("debug", "issue id of incorrect type");
        res.redirect(vroot);
    } else if (isNaN(Number(req.params.issue))) {
        req.logger.log("debug", "issue id is not identifier");
        res.redirect(vroot);
    } else {
        req.logger.log("debug", "open request for issue %s", req.params.issue);
        var results = await connection
            .select("assigneeid", "isclosed", "projectid")
            .from("issues")
            .where({
                "id": req.params.issue
            });
        if (results.length < 1) {
            res.redirect(vroot + "issues");
            return;
        }
        if ((req.user.id === results[0].assigneeid && await provePermission(req.user.role, "issues.changestatus.own")) ||
            await provePermission(req.user.role, "issues.changestatus.other") || results[0].assigneeid === req.user.id) {
            req.logger.log("debug", "opening issue %s", req.params.issue);
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
            req.logger.log("debug", "successfully opened issue %s", req.params.issue);
            res.redirect(vroot + "issues/" + req.params.issue + "/posts");
        } else {
            req.logger.log("debug", "user is not privileged enough to open issue");
            permissionError(req, res);
        }
    }
}));
router.get(vroot + "issues/:issue/close", async(async function (req, res, next) {
    if (typeof req.params.issue !== typeof "") {
        req.logger.log("debug", "issue id of incorrect type");
        res.redirect(vroot);
    } else if (isNaN(Number(req.params.issue))) {
        req.logger.log("debug", "issue id is not identifier");
        res.redirect(vroot);
    } else {
        req.logger.log("debug", "close request for issue %s", req.params.issue);
        var results = await connection
            .select("assigneeid", "isclosed")
            .from("issues")
            .where({
                "id": req.params.issue
            });
        if (results.length < 1) {
            res.redirect(vroot + "issues");
            return;
        }
        if ((req.user.id === results[0].assigneeid && await provePermission(req.user.role, "issues.changestatus.own")) ||
            await provePermission(req.user.role, "issues.changestatus.other")) {
            req.logger.log("debug", "closing issue %s", req.params.issue);
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
            req.logger.log("debug", "successfully closed issue %s", req.params.issue);
            res.redirect(vroot + "issues/" + req.params.issue + "/posts");
        } else {
            req.logger.log("debug", "user is not privileged enough to close issue");
            permissionError(req, res);
        }
    }
}));

module.exports = router;
