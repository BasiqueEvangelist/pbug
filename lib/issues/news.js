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

var last = (arr, n) => arr.slice(Math.max(arr.length - n, 0));

router.get(vroot, requiresLogin, async(async function (req, res, next) {
    res.render("news", {
        things: await processActivities(await connection
            .select("issueactivities.id", "dateofoccurance",
                "issueactivities.issueid", "issueactivities.authorid",
                "data", "users.fullname", "issues.issuename",
                "projects.shortprojectid")
            .from("issueactivities")
            .leftJoin("issues", "issueactivities.issueid", "issues.id")
            .innerJoin("issuewatchers", function () {
                this.on("issues.id", "issuewatchers.issueid").andOn("issuewatchers.watcherid", req.user.id);
            })
            .leftJoin("users", "issueactivities.authorid", "users.id")
            .leftJoin("projects", "issues.projectid", "projects.id")
            .orderBy("issueactivities.dateofoccurance", "desc")
            .limit(100)
        )
    });
}));

module.exports = router;