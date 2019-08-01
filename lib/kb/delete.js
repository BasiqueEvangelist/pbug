var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var { needsPermission, async, permissionError } = require("../common.js");
var { proveSecrecy, getMaxSecrecy } = require("./common");

router.get(vroot + "kb/delete/:path([a-zA-Z/0-9_]+)", needsPermission("kb.delete"), async(async function (req, res, next) {
    if (typeof req.params.path !== typeof "") res.redirect(vroot);
    else {
        var infopages = await connection
            .select("infopages.secrecy")
            .from("infopages")
            .where({
                "infopages.path": req.params.path
            });
        if (infopages.length < 1) {
            res.redirect(vroot);
        } else if (!proveSecrecy(req.user.permissions, infopages[0].secrecy)) {
            permissionError(req, res);
            return;
        } else {
            await connection("infopages")
                .where({
                    "infopages.path": req.params.path
                })
                .del();
            res.redirect(vroot + "kb");
        }

    }
}));


module.exports = router;
