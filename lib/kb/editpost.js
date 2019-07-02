var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var { requiresLogin } = require("../common.js");

router.get(vroot + "kb/post/:post/edit", async function (req, res, next) {
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
            })
        if (posts.length < 1) {
            res.redirect(vroot);
        } else if (posts[0].authorid !== req.user.id) {
            res.redirect(vroot);
        } else
            res.render("editcomment", {
                post: posts[0]
            });
    }
});
router.post(vroot + "kb/post/:post/edit", requiresLogin, async function (req, res, next) {
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
            })
        if (posts.length < 1) {
            res.redirect(vroot);
        } else if (posts[0].authorid !== req.user.id) {
            res.redirect(vroot);
        } else {
            await connection("infopagecomments")
                .where({
                    "id": req.params.post
                })
                .update({
                    "containedtext": req.body.newtext,
                    "dateofedit": new Date()
                })
            res.redirect(vroot + "kb/" + posts[0].infopageid + "#" + req.params.post);
        }
    }
});

module.exports = router;
