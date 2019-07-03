var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");

router.get(vroot + "kb/:infopage", async function (req, res, next) {
    if (isNaN(Number(req.params.infopage))) {
        debug.kbapi("infopage id is not identifier");
        res.redirect(vroot);
        return;
    }
    debug.kbapi("infopage request for infopage %s", req.params.infopage);
    var infopages = await connection
        .select("infopages.*", "users.fullname")
        .from("infopages")
        .leftJoin("users", "infopages.authorid", "users.id")
        .where({
            "infopages.id": Number(req.params.infopage)
        })
    if (infopages.length < 1) {
        debug.kbapi("infopage %s not found", req.params.infopage);
        res.status(404).render("errors/404");
        return;
    }
    debug.kbapi("successfully retrieved kb");
    var comments = await connection
        .select("infopagecomments.*", "users.fullname")
        .from("infopagecomments")
        .leftJoin("users", "infopagecomments.authorid", "users.id")
        .where({
            "infopagecomments.infopageid": req.params.infopage
        })
        .orderBy("infopagecomments.id", "asc")
    debug.kbapi("successfully retrieved infopage posts");
    res.render("kb/view", {
        infopage: infopages[0],
        comments: comments,
    });
});

module.exports = router;
