var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var { needsPermission, async, permissionError } = require("../common.js");
var { proveSecrecy, getMaxSecrecy } = require("./common");

router.get(vroot + "kb/edit/:path([a-zA-Z/0-9_]+)", needsPermission("kb.edit"), async(async function (req, res, next) {
    if (typeof req.params.path !== typeof "") res.redirect(vroot);
    else {
        var infopages = await connection
            .select("infopages.id", "infopages.containedtext", "infopages.authorid",
                "infopages.dateofcreation", "infopages.dateofedit", "infopages.pagename",
                "infopages.pagetags", "infopages.secrecy", "users.fullname")
            .from("infopages")
            .leftJoin("users", "infopages.authorid", "users.id")
            .where({
                "infopages.path": req.params.path
            });
        if (infopages.length < 1) {
            res.redirect(vroot);
        } else if (!proveSecrecy(req.user.permissions, infopages[0].secrecy)) {
            permissionError(req, res);
            return;
        } else
            res.render("kb/edit", {
                infopage: infopages[0],
                getMaxSecrecy: getMaxSecrecy
            });
    }
}));
router.post(vroot + "kb/edit/:path([a-zA-Z/0-9_]+)", needsPermission("kb.edit"), async(async function (req, res, next) {
    if (typeof req.params.path !== typeof "") res.status(400).end();
    else if (typeof req.body.newtext !== typeof "") res.status(400).end();
    else if (req.body.newtext === "") res.redirect("back");
    else if (typeof req.body.newtitle !== typeof "") res.status(400).end();
    else if (req.body.newtitle === "") res.redirect("back");
    else if (typeof req.body.newtags !== typeof "") res.status(400).end();
    else if (typeof req.body.secrecy !== typeof "") res.status(400).end();
    else if (isNaN(Number(req.body.secrecy))) res.status(400).end();
    else {
        var infopages = await connection
            .select("authorid", "secrecy")
            .from("infopages")
            .where({
                "path": req.params.path
            });
        if (infopages.length < 1) {
            res.redirect(vroot);
        } else if (!proveSecrecy(req.user.permissions, infopages[0].secrecy)) {
            permissionError(req, res);
            return;
        } else if (!proveSecrecy(req.user.permissions, Number(req.body.secrecy))) {
            permissionError(req, res);
            return;
        } else {
            await connection("infopages")
                .where({
                    "path": req.params.path
                })
                .update({
                    "containedtext": req.body.newtext,
                    "pagename": req.body.newtitle,
                    "pagetags": req.body.newtags,
                    "dateofedit": new Date(),
                    "secrecy": req.body.secrecy
                });
            res.redirect(vroot + "kb/view/" + req.params.path);
        }
    }
}));

module.exports = router;
