var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var { requiresLogin, insertActivity } = require("../common.js");
var debug = require("../debug");

router.get(vroot + "issues/:issue/assign", requiresLogin, async function (req, res, next) {
    if (typeof req.params.issue !== typeof "") {
        debug.issueapi("issue id of incorrect type");
        res.redirect(vroot);
    } else if (isNaN(Number(req.params.issue))) {
        debug.issueapi("issue id is not identifier");
        res.redirect(vroot);
    } else if (typeof req.query.userid !== typeof "") {
        debug.issueapi("chosen assignee id of incorrect type");
        res.redirect(vroot);
    } else if (isNaN(Number(req.query.userid))) {
        debug.issueapi("chosen assignee  id is not identifier");
        res.redirect(vroot);
    } else {
        debug.issueapi("assign request for issue %s", req.params.issue);
        var issues = await connection
            .select("assigneeid")
            .from("issues")
            .where({
                "id": req.params.issue
            });
        await connection("issues")
            .where({
                "id": req.params.issue
            })
            .update({
                "assigneeid": req.query.userid === "-1" ? null : req.query.userid
            })
        await insertActivity(req.params.issue, req.user.id, {
            type: "assign",
            newassigneeid: Number(req.query.userid),
            oldassigneeid: issues[0].assigneeid === null ? -1 : issues[0].assigneeid
        });
        debug.issueapi("changed assignee for issue %s", req.params.issue);
        res.redirect(vroot + "issues/" + req.params.issue + "/posts");
    }
});

module.exports = router;
