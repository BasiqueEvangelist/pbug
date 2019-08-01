var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var { async, needsPermission } = require("../common");

router.get(vroot + "kb/talk/:path([a-zA-Z/0-9_]+)", needsPermission("kb.view"), async(async function (req, res, next) {
    req.logger.log("debug", "infopage request for infopage %s", req.params.path);
    var infopages = await connection
        .select("infopages.id", "infopages.pagename")
        .from("infopages")
        .where({
            "infopages.path": req.params.path
        });
    if (infopages.length < 1) {
        req.logger.log("debug", "infopage %s not found", req.params.path);
        res.status(404).render("errors/404");
        return;
    }
    req.logger.log("debug", "successfully retrieved kb");
    var comments = await connection
        .select("infopagecomments.*", "users.fullname")
        .from("infopagecomments")
        .leftJoin("users", "infopagecomments.authorid", "users.id")
        .where({
            "infopagecomments.infopageid": infopages[0].id
        })
        .orderBy("infopagecomments.id", "asc");
    res.render("kb/talk", {
        infopage: infopages[0],
        comments: comments
    });
}));

module.exports = router;
