var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var { requiresLogin, catchFiles, insertActivity } = require("../common.js");

router.get(vroot + "issues/:issue/edit", requiresLogin, async function (req, res, next) {
    if (typeof req.params.issue !== typeof "") res.redirect(vroot);
    else if (isNaN(Number(req.params.issue))) res.redirect(vroot);
    else {
        var issues = await connection
            .select("issues.*", "users.fullname")
            .from("issues")
            .leftJoin("users", "issues.authorid", "users.id")
            .where({
                "issues.id": req.params.issue
            });
        if (issues.length < 1)
            res.redirect(vroot);
        else if (issues[0].authorid !== req.user.id && !req.user.isadmin)
            res.redirect(vroot);
        else {
            res.render("issues/editissue", {
                issue: issues[0],
                projects: await connection
                    .select("id", "projectname")
                    .from("projects"),
                users: await connection
                    .select("id", "fullname")
                    .from("users")
            });
        }
    }
});
router.post(vroot + "issues/:issue/edit", catchFiles(), async function (req, res, next) {
    if (typeof req.params.issue !== typeof "") res.status(400).end();
    else if (isNaN(Number(req.params.issue))) res.status(400).end();
    else if (isNaN(Number(req.body.newassigneeid))) res.status(400).end();
    else if (isNaN(Number(req.body.newprojectid))) res.status(400).end();
    else if (typeof req.body.newdesc !== typeof "") res.status(400).end();
    else if (typeof req.body.newtitle !== typeof "") res.status(400).end();
    else if (typeof req.body.newtags !== typeof "") res.status(400).end();
    else {
        var issues = await connection
            .select("issues.*", "users.fullname")
            .leftJoin("users", "issues.authorid", "users.id")
            .from("issues")
            .where({
                "issues.id": req.params.issue
            });
        if (issues.length < 1) {
            res.redirect(vroot);
        } else if (issues[0].authorid !== req.user.id && !req.user.isadmin) {
            res.redirect(vroot);
        } else {
            await connection("issues")
                .where({
                    "id": req.params.issue
                })
                .update({
                    "description": req.body.newdesc,
                    "issuename": req.body.newtitle,
                    "issuetags": req.body.newtags,
                    "assigneeid": req.body.newassigneeid === "-1" ? null : Number(req.body.newassigneeid),
                    "projectid": req.body.newprojectid,
                    // "dateofedit": new Date()
                });
            await insertActivity(req.params.issue, req.user.id, {
                type: "editissue",
                issueid: req.params.issue,
                from: {
                    text: issues[0].description,
                    tags: issues[0].issuetags,
                    title: issues[0].issuename
                },
                to: {
                    text: req.body.newtext,
                    tags: req.body.newtags,
                    title: req.body.newtitle
                }
            });
            res.redirect(vroot + "issues/" + req.params.issue + "/posts");
        }
    }
});

module.exports = router;
