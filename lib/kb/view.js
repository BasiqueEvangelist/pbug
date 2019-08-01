var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var { async, needsPermission, permissionError } = require("../common");
var { proveSecrecy } = require("./common");

router.get(vroot + "kb/view/:path([a-zA-Z/0-9_]+)", needsPermission("kb.view"), async(async function (req, res, next) {
    req.logger.log("debug", "infopage request for infopage %s", req.params.path);
    var infopages = await connection
        .select("infopages.*", "users.fullname")
        .from("infopages")
        .leftJoin("users", "infopages.authorid", "users.id")
        .where({
            "infopages.path": req.params.path
        });
    if (infopages.length < 1) {
        req.logger.log("debug", "infopage %s not found", req.params.path);
        res.status(404).render("errors/404");
        return;
    }
    req.logger.log("debug", "successfully retrieved kb");
    if (!proveSecrecy(req.user.permissions, infopages[0].secrecy)) {
        permissionError(req, res);
        return;
    }
    req.logger.log("debug", "successfully retrieved infopage posts");
    res.render("kb/view", {
        infopage: infopages[0]
    });
}));

module.exports = router;
