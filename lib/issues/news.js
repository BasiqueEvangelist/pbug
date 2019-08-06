var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var { async, requiresLogin } = require("../common.js");
var { processActivities } = require("./common.js");

function mkdate(val) {
    if (val instanceof Date) return val;
    else return new Date(val);
};

router.get(vroot + "news", requiresLogin, async(async function (req, res, next) {
    var watched = await connection()
        .select("issues.id", "issues.issuename", "projects.shortprojectid")
        .from("issuewatchers")
        .leftJoin("issues", "issuewatchers.issueid", "issues.id")
        .leftJoin("projects", "issues.projectid", "projects.id")
        .where({
            "watcherid": req.user.id
        });
    res.render("news", {
        things: (await Promise.all(watched.map(async issue =>
            (await processActivities(issue.id)).map(x => { x.issue = issue; return x; }))))
            .flat(1).concat().sort((a, b) => mkdate(a.dateofoccurance).getTime() - mkdate(b.dateofocurrance).getTime())
    });
}));

module.exports = router;