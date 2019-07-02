var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var { requiresLogin, insertActivity, catchFiles } = require("../common.js");

router.get(vroot + "issues/post/:post/edit", requiresLogin, async function (req, res, next) {
    if (typeof req.params.post !== typeof "") res.redirect(vroot);
    else if (isNaN(Number(req.params.post))) res.redirect(vroot);
    else {
        var posts = await connection
            .select("issueposts.*", "users.fullname")
            .from("issueposts")
            .leftJoin("users", "issueposts.authorid", "users.id")
            .where({
                "issueposts.id": req.params.post
            });
        if (posts.length < 1)
            res.redirect(vroot);
        else if (posts[0].authorid !== req.user.id && !req.user.isadmin)
            res.redirect(vroot);
        else {
            res.render("issues/editpost", {
                post: posts[0]
            });
        }
    }
});

router.post(vroot + "issues/post/:post/edit", catchFiles(), async function (req, res, next) {
    if (typeof req.params.post !== typeof "") res.status(400).end();
    else if (isNaN(Number(req.params.post))) res.status(400).end();
    else if (typeof req.body.newtext !== typeof "") res.status(400).end();
    else if (req.body.newtext === "") res.redirect("back");
    else {
        var posts = await connection
            .select("authorid", "issueid", "containedtext")
            .from("issueposts")
            .where({
                "id": req.params.post
            });
        if (posts.length < 1) {
            res.redirect(vroot);
        } else if (posts[0].authorid !== req.user.id && !req.user.isadmin) {
            res.redirect(vroot);
        } else {
            await connection("issueposts")
                .where({
                    "id": req.params.post
                })
                .update({
                    "containedtext": req.body.newtext,
                    "dateofedit": new Date()
                });
            await insertActivity(posts[0].issueid, req.user.id, {    
                type: "editpost",
                postid: req.params.post,
                from: {
                    text: posts[0].containedtext,
                },
                to: {
                    text: req.body.newtext,
                }
            });
            res.redirect(vroot + "issues/" + posts[0].issueid + "/posts#" + req.params.post);
        }
    }
});

module.exports = router;
