var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var { async, requiresLogin } = require("../common.js");
var { processActivities } = require("./common.js");

router.get(vroot + "news", requiresLogin, async(async function (req, res, next) {
    res.render("news", {
        issues: await Promise.all((await connection()
            .select("issueid")
            .from("issuewatchers")
            .where({
                "watcherid": req.user.id
            })).map(async x => ({
                issue: x.issueid, things: await processActivities(x.issueid)
            })))
    });
}));

module.exports = router;