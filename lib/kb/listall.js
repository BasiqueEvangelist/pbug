var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");

router.get(vroot + "kb/list/all", async function (req, res, next) {
    debug.issueapi("showing all kb pages");
    var results = await connection
        .select("infopages.id", "infopages.pagename")
        .from("infopages")
        .orderBy("infopages.id", "desc")
    debug.issueapi("kb pages retrieved, sending body");
    res.render("kb/listall", {
        kbs: results
    });
});

module.exports = router;
