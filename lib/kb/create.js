var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var { requiresLogin, async } = require("../common.js");

router.get(vroot + "kb/create", requiresLogin, function (req, res, next) {
    res.render("kb/create");
});

router.post(vroot + "kb/create", requiresLogin, async(async function (req, res, next) {
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
    } else {
        req.logger.log("debug", "%s is creating info page", req.user.username);
        var id = (await connection("infopages")
            .insert({
                "pagename": req.body.name,
                "pagetags": req.body.tags,
                "authorid": req.user.id,
                "editorid": req.user.id,
                "containedtext": req.body.text,
                "dateofcreation": new Date(),
                "dateofedit": new Date()
            })
            .returning("id"))[0];
        req.logger.log("debug", "successfully created infopage");
        res.redirect(vroot + "kb/" + id);
    }
}));

module.exports = router;
