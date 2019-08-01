var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var { needsPermission, async, permissionError } = require("../common.js");
var { proveSecrecy, getMaxSecrecy } = require("./common");

router.get(vroot + "kb/create/:path([a-zA-Z/0-9_]+)", needsPermission("kb.create"), function (req, res, next) {
    res.render("kb/create", { getMaxSecrecy: getMaxSecrecy });
});

router.post(vroot + "kb/create/:path([a-zA-Z/0-9_]+)", needsPermission("kb.create"), async(async function (req, res, next) {
    if (typeof req.body.name !== typeof "string") {
        req.logger.log("debug", "info page name of incorrect type");
        res.status(400).end();
    } else if (req.body.name === "") {
        req.logger.log("debug", "info page name empty");
        res.redirect(vroot);
    } else if (typeof req.body.text !== typeof "string") {
        req.logger.log("debug", "info page text of incorrect type");
        res.status(400).end();
    } else if (req.body.text === "") {
        req.logger.log("debug", "info page text empty");
        res.redirect(vroot);
    } else if (typeof req.body.tags !== typeof "string") {
        req.logger.log("debug", "info page tags of incorrect type");
        res.status(400).end();
    } else if (typeof req.body.secrecy !== typeof "string") {
        req.logger.log("debug", "info page secrecy of incorrect type");
        res.status(400).end();
    } else if (isNaN(Number(req.body.secrecy))) {
        req.logger.log("debug", "info page secrecy is invalid");
        res.redirect(vroot);
    } else {
        var infopages = await connection
            .select("id")
            .from("infopages")
            .where({
                "path": req.params.path
            });
        if (infopages.length > 1) {
            res.redirect(vroot + "kb/view/" + req.params.path);
            return;
        }
        if (!proveSecrecy(req.user.permissions, Number(req.body.secrecy))) {
            req.logger.log("debug", "user can't create with this secrecy");
            permissionError(req, res);
            return;
        }
        req.logger.log("debug", "%s is creating info page", req.user.username);
        var id = (await connection("infopages")
            .insert({
                "path": req.params.path,
                "pagename": req.body.name,
                "pagetags": req.body.tags,
                "authorid": req.user.id === -1 ? null : req.user.id,
                "editorid": req.user.id === -1 ? null : req.user.id,
                "containedtext": req.body.text,
                "dateofcreation": new Date(),
                "dateofedit": new Date(),
                "secrecy": Number(req.body.secrecy)
            })
            .returning("id"))[0];
        req.logger.log("debug", "successfully created infopage");
        res.redirect(vroot + "kb/view/" + req.params.path);
    }
}));

module.exports = router;
