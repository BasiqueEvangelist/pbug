var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var { permissionError, async } = require("../common.js");
var { provePermission } = require("../permissions.js");

router.get(vroot + "kb/post/:post/edit", async(async function (req, res, next) {
    if (typeof req.params.post !== typeof "") res.redirect(vroot);
    else if (isNaN(Number(req.params.post))) res.redirect(vroot);
    else {
        var posts = await connection
            .select("infopagecomments.id", "infopagecomments.containedtext", "infopagecomments.authorid",
                "infopagecomments.dateofcreation", "infopagecomments.dateofedit", "users.fullname")
            .from("infopagecomments")
            .leftJoin("users", "infopagecomments.authorid", "users.id")
            .where({
                "infopagecomments.id": req.params.post
            });
        if (posts.length < 1) {
            res.redirect(vroot);
        } else if (!((posts[0].authorid === req.user.id && provePermission(req.user.permissions, "kb.editpost.own")) || provePermission(req.user.permissions, "kb.editpost.other"))) {
            permissionError(req, res);
        } else
            res.render("kb/editcomment", {
                post: posts[0]
            });
    }
}));
router.post(vroot + "kb/post/:post/edit", async(async function (req, res, next) {
    if (typeof req.params.post !== typeof "") res.status(400).end();
    else if (isNaN(Number(req.params.post))) res.status(400).end();
    else if (typeof req.body.newtext !== typeof "") res.status(400).end();
    else if (req.body.newtext === "") res.redirect("back");
    else {
        var posts = await connection
            .select("authorid", "infopageid")
            .from("infopagecomments")
            .where({
                "id": req.params.post
            });
        if (posts.length < 1) {
            res.redirect(vroot);
        } else if (!((posts[0].authorid === req.user.id && provePermission(req.user.permissions, "kb.editpost.own")) || provePermission(req.user.permissions, "kb.editpost.other"))) {
            permissionError(req, res);
        } else {
            await connection("infopagecomments")
                .where({
                    "id": req.params.post
                })
                .update({
                    "containedtext": req.body.newtext,
                    "dateofedit": new Date()
                });
            res.redirect(vroot + "kb/" + posts[0].infopageid + "/talk#" + req.params.post);
        }
    }
}));

module.exports = router;
