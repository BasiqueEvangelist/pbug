var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var { async, needsPermission, requiresLogin } = require("../common.js");

router.get(vroot + "issues/:issue/watch", requiresLogin, needsPermission("issues.view.posts"), async(async function (req, res, next) {
    if (typeof req.params.issue !== typeof "") {
        req.logger.log("debug", "issue id of incorrect type");
        res.redirect(vroot);
    } else if (isNaN(Number(req.params.issue))) {
        req.logger.log("debug", "issue id is not identifier");
        res.redirect(vroot);
    } else {
        req.logger.log("debug", "watch toogle request for issue %s by %s", req.params.issue, req.user.username);
        if ((await connection
            .count({
                "all": "*"
            })
            .from("issues")
            .where({
                "id": req.params.issue
            }))[0].all < 1) {
            res.redirect(vroot + "issues");
            return;
        }
        if ((await connection
            .count({
                "all": "*"
            })
            .from("issuewatchers")
            .where({
                "watcherid": req.user.id,
                "issueid": Number(req.params.issue)
            }))[0].all < 1) {
            req.logger.log("debug", "watching issue %s for %s", req.params.issue, req.user.username);
            await connection("issuewatchers")
                .insert({
                    "watcherid": req.user.id,
                    "issueid": Number(req.params.issue)
                });
        }
        else {
            req.logger.log("debug", "unwatching issue %s for %s", req.params.issue, req.user.username);
            await connection("issuewatchers")
                .where({
                    "watcherid": req.user.id,
                    "issueid": Number(req.params.issue)
                })
                .del();
        }
        req.logger.log("debug", "successfully toggled watch status for issue %s", req.params.issue);
        res.redirect(vroot + "issues/" + req.params.issue + "/posts");
    }
}));

module.exports = router;