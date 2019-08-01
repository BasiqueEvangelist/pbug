var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var { async, needsPermission, permissionError } = require("../common");
var { proveSecrecy } = require("./common");

router.post(vroot + "kb/talk/:path([a-zA-Z/0-9_]+)", needsPermission("kb.post"), async(async function (req, res, next) {
    if (typeof req.params.path !== typeof "") res.redirect(vroot);
    else if (typeof req.body.text !== typeof "") res.status(400).end();
    else if (req.body.text === "") res.redirect(vroot);
    else {
        var infopages = await connection
            .select("secrecy", "id")
            .from("infopages")
            .where({
                "path": req.params.path
            });
        if (infopages.length < 1) {
            res.redirect(vroot);
            return;
        }
        if (!proveSecrecy(req.user.permissions), infopages[0].secrecy) {
            permissionError(req, res);
            return;
        }
        var id = (await connection("infopagecomments")
            .insert({
                "containedtext": req.body.text,
                "authorid": req.user.id === -1 ? null : req.user.id,
                "infopageid": infopages[0].id,
                "dateofcreation": new Date()
            })
            .returning("id"))[0];
        res.redirect(vroot + "kb/talk/" + req.params.path + "#" + id);
    }
}));

module.exports = router;
