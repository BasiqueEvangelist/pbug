var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var { async, needsPermission } = require("../common");

router.get(vroot + "issues/:issue/delete/areyousure", needsPermission("issues.delete"), function (req, res) {
    res.render("areyousure");
});
router.get(vroot + "issues/:issue/delete", needsPermission("issues.delete"), async(async function (req, res, next) {
    if (typeof req.params.issue !== typeof "") {
        req.logger.log("debug", "issue id of incorrect type");
        res.redirect(vroot);
    } else if (isNaN(Number(req.params.issue))) {
        req.logger.log("debug", "issue id is not identifier");
        res.redirect(vroot);
    } else {
        await connection("issueposts")
            .where({
                "issueid": req.params.issue
            })
            .del();
        req.logger.log("debug", "deleted all posts in issue %s", req.params.issue);
        await connection("issueactivities")
            .where({
                "issueid": req.params.issue
            })
            .del();
        req.logger.log("debug", "deleted all activity in issue %s", req.params.issue);
        await connection("issuefiles")
            .where({
                "issueid": req.params.issue
            })
            .del();
        req.logger.log("debug", "deleted all files linked to issue %s", req.params.issue);
        await connection("issues")
            .where({
                "id": req.params.issue
            })
            .del();
        req.logger.log("debug", "deleted issue %s", req.params.issue);
        res.redirect(vroot + "issues");
    }
}));

module.exports = router;
