var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var { needsPermission, async, permissionError } = require("../common.js");
var { proveSecrecy, getMaxSecrecy } = require("./common");

router.get(vroot + "kb/:infopage/delete", needsPermission("kb.delete"), async(async function (req, res, next) {
    if (typeof req.params.infopage !== typeof "") res.redirect(vroot);
    else if (isNaN(Number(req.params.infopage))) res.redirect(vroot);
    else {
        var infopages = await connection
            .select("infopages.secrecy")
            .from("infopages")
            .where({
                "infopages.id": req.params.infopage
            });
        if (infopages.length < 1) {
            res.redirect(vroot);
        } else if (!proveSecrecy(req.user.permissions, infopages[0].secrecy)) {
            permissionError(req, res);
            return;
        } else {
            await connection("infopages")
                .where({
                    "infopages.id": req.params.infopage
                })
                .del();
            res.redirect(vroot + "kb");
        }

    }
}));


module.exports = router;
