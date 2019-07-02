var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var { requiresLogin } = require("../common.js");

router.get(vroot + "kb/tag/:tag/remove", requiresLogin, async function (req, res, next) {
    if (typeof req.params.tag !== typeof "") res.redirect(vroot);
    else if (isNaN(Number(req.params.tag))) res.redirect(vroot);
    else {
        var tags = await connection
            .select("infopageid", "tagtext")
            .from("infopagetags")
            .where({
                "id": req.params.tag
            })
        if (tags.length < 1) {
            res.redirect(vroot);
        } else {
            await connection("infopagetags")
                .where({
                    "id": req.params.tag
                })
                .del()
            res.redirect(vroot + "kb/" + tags[0].infopageid);
        }
    }
});
router.get(vroot + "kb/:infopage/addtag", requiresLogin, async function (req, res, next) {
    if (typeof req.params.infopage !== typeof "") {
        debug.issueapi("infopage id of incorrect type");
        res.redirect(vroot);
    } else if (isNaN(Number(req.params.infopage))) {
        debug.issueapi("infopage id is not identifier");
        res.redirect(vroot);
    } else if (typeof req.query.tagtext !== typeof "") {
        debug.issueapi("tag text of incorrect type");
        res.redirect(vroot);
    } else if (req.query.tagtext === "") {
        debug.issueapi("tag text empty");
        res.redirect("back");
    } else {
        debug.issueapi("addtag request for infopage %s", req.params.infopage);
        await connection("infopagetags")
            .insert({
                "tagtext": req.query.tagtext,
                "infopageid": req.params.infopage
            })
        debug.issueapi("added tag to infopage %s", req.params.infopage);
        res.redirect(vroot + "kb/" + req.params.infopage);
    }
});

module.exports = router;
