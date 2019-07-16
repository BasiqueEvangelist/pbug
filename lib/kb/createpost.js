var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");

router.post(vroot + "kb/:infopage", async function (req, res, next) {
    if (typeof req.params.infopage !== typeof "") res.redirect(vroot);
    else if (isNaN(Number(req.params.infopage))) res.redirect(vroot);
    else if (typeof req.body.text !== typeof "") res.status(400).end();
    else if (req.body.text === "") res.redirect(vroot);
    else {
        var id = (await connection("infopagecomments")
            .insert({
                "containedtext": req.body.text,
                "authorid": req.session.loginid,
                "infopageid": req.params.infopage,
                "dateofcreation": new Date()
            })
            .returning("id"))[0]
        res.redirect(vroot + "kb/" + req.params.infopage + "#" + id);
    }
});

module.exports = router;