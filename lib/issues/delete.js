var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");

router.get(vroot + "issues/:issue/delete/areyousure", async function (req, res) {
    res.render("areyousure");
});
router.get(vroot + "issues/:issue/delete", async function (req, res, next) {
    if (!req.user.isadmin) {
        debug.issueapi("non-admin user trying to delete issue");
        res.redirect(vroot);
    } else if (typeof req.params.issue !== typeof "") {
        debug.issueapi("issue id of incorrect type");
        res.redirect(vroot);
    } else if (isNaN(Number(req.params.issue))) {
        debug.issueapi("issue id is not identifier");
        res.redirect(vroot);
    } else {
        await connection("issueposts")
            .where({
                "issueid": req.params.issue
            })
            .del()
        debug.issueapi("deleted all posts in issue %s", req.params.issue);
        await connection("issueactivities")
            .where({
                "issueid": req.params.issue
            })
            .del();
        debug.issueapi("deleted all activity in issue %s", req.params.issue);
        await connection("issues")
            .where({
                "id": req.params.issue
            })
            .del();
        debug.issueapi("deleted issue %s", req.params.issue);
        res.redirect(vroot + "issues");
    }
});

module.exports = router;
