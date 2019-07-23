var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var { insertActivity, async } = require("../common.js");

router.post(vroot + "issues/:issue", async(async function (req, res, next) {
    if (typeof req.params.issue !== typeof "") res.redirect(vroot);
    else if (isNaN(Number(req.params.issue))) res.redirect(vroot);
    else if (typeof req.body.text !== typeof "") res.status(400).end();
    else if (req.body.text === "") res.redirect(vroot);
    else {
        var ids = await connection("issueposts")
            .insert({
                "containedtext": req.body.text,
                "authorid": req.session.loginid,
                "issueid": req.params.issue,
                "dateofcreation": new Date()
            })
            .returning("id");
        await insertActivity(req.params.issue, req.user.id, {
            type: "post",
            text: req.body.text
        });
        res.redirect(vroot + "issues/" + req.params.issue + "/posts#" + ids[0]);
    }
}));

module.exports = router;
