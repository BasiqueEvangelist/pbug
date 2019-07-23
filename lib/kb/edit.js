var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var { requiresLogin, async } = require("../common.js");

router.get(vroot + "kb/:infopage/edit", requiresLogin, async(async function (req, res, next) {
    if (typeof req.params.infopage !== typeof "") res.redirect(vroot);
    else if (isNaN(Number(req.params.infopage))) res.redirect(vroot);
    else {
        var infopages = await connection
            .select("infopages.id", "infopages.containedtext", "infopages.authorid",
                "infopages.dateofcreation", "infopages.dateofedit", "infopages.pagename",
                "infopages.pagetags", "users.fullname")
            .from("infopages")
            .leftJoin("users", "infopages.authorid", "users.id")
            .where({
                "infopages.id": req.params.infopage
            });
        if (infopages.length < 1) {
            res.redirect(vroot);
        } else
            res.render("kb/edit", {
                infopage: infopages[0]
            });
    }
}));
router.post(vroot + "kb/:infopage/edit", requiresLogin, async(async function (req, res, next) {
    if (typeof req.params.infopage !== typeof "") res.status(400).end();
    else if (isNaN(Number(req.params.infopage))) res.status(400).end();
    else if (typeof req.body.newtext !== typeof "") res.status(400).end();
    else if (req.body.newtext === "") res.redirect("back");
    else if (typeof req.body.newtitle !== typeof "") res.status(400).end();
    else if (req.body.newtitle === "") res.redirect("back");
    else if (typeof req.body.newtags !== typeof "") res.status(400).end();
    else {
        var infopages = await connection
            .select("authorid")
            .from("infopages")
            .where({
                "id": req.params.infopage
            });
        if (infopages.length < 1) {
            res.redirect(vroot);
        } else {
            await connection("infopages")
                .where({
                    "id": req.params.infopage
                })
                .update({
                    "containedtext": req.body.newtext,
                    "pagename": req.body.newtitle,
                    "pagetags": req.body.newtags,
                    "dateofedit": new Date()
                });
            res.redirect(vroot + "kb/" + req.params.infopage);
        }
    }
}));

module.exports = router;
