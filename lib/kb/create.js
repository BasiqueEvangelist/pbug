var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var { requiresLogin } = require("../common.js");

router.get(vroot + "kb/create", requiresLogin, async function (req, res, next) {
    res.render("kb/create");
});

router.post(vroot + "kb/create", requiresLogin, async function (req, res, next) {
    if (typeof req.body.name !== typeof "string") {
        debug.issueapi("info page name of incorrect type");
        res.status(400).end();
    } else if (req.body.name === "") {
        debug.issueapi("info page name empty");
        res.redirect(vroot);
    } else if (typeof req.body.text !== typeof "string") {
        debug.issueapi("info page text of incorrect type");
        res.status(400).end();
    } else if (req.body.text === "") {
        debug.issueapi("info page text empty");
        res.redirect(vroot);
    } else {
        debug.issueapi("%s is creating info page", req.user.username);
        var id = (await connection("infopages")
            .insert({
                "pagename": req.body.name,
                "authorid": req.user.id,
                "editorid": req.user.id,
                "containedtext": req.body.text,
                "dateofcreation": new Date(),
                "dateofedit": new Date()
            })
            .returning("id"))[0]
        debug.issueapi("successfully created infopage");
        res.redirect(vroot + "kb/" + id);
    }
});

module.exports = router;
