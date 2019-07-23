var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var { catchFiles, requiresLogin, insertActivity } = require("../common");
var debug = require("../debug");

router.get(vroot + "issues/create", requiresLogin, async function (req, res, next) {
    res.render("issues/create", {
        projects: await connection
            .select("id", "projectname")
            .from("projects"),
        users: await connection
            .select("id", "fullname")
            .from("users")
    });
});

router.post(vroot + "issues/create", catchFiles(), async function (req, res, next) {
    if (typeof req.body.name !== typeof "string") {
        req.logger.log("debug", "issue name of incorrect type");
        res.status(400).end();
    } else if (req.body.name === "") {
        req.logger.log("debug", "issue name empty");
        res.redirect(vroot);
    } else if (typeof req.body.firsttext !== typeof "string") {
        req.logger.log("debug", "issue text (text of first post) of incorrect type");
        res.status(400).end();
    } else if (req.body.firsttext === "") {
        req.logger.log("debug", "issue text (text of first post) empty");
        res.redirect(vroot);
    } else if (typeof req.body.projectid !== typeof "string") {
        req.logger.log("debug", "issue project of incorrect type");
        res.status(400).end();
    } else if (isNaN(Number(req.body.projectid))) {
        req.logger.log("debug", "issue project is not an identifier");
        res.status(400).end();
    } else if (typeof req.body.tags !== typeof "string") {
        req.logger.log("debug", "issue tags of incorrect type");
        res.status(400).end();
    } else if (typeof req.body.assigneeid !== typeof "string") {
        req.logger.log("debug", "issue assignee id of incorrect type");
        res.status(400).end();
    } else if (isNaN(Number(req.body.assigneeid))) {
        req.logger.log("debug", "issue assignee id is not an identifier");
        res.status(400).end();
    } else {
        req.logger.log("debug", "%s is creating issue", req.user.username);
        var id = (await connection("issues")
            .insert({
                "issuename": req.body.name,
                "projectid": Number(req.body.projectid),
                "authorid": req.user.id,
                "description": req.body.firsttext,
                "dateofcreation": new Date(),
                "issuetags": req.body.tags,
                "assigneeid": req.body.assigneeid === "-1" ? null : Number(req.body.assigneeid)
            })
            .returning("id"))[0];
        await insertActivity(id, req.user.id, {
            type: "createissue",
            text: req.body.firsttext,
            tags: req.body.tags,
            title: req.body.name
        });
        for (var filefield in req.files) {
            for (var fileobj of req.files[filefield]) {
                await connection("issuefiles")
                    .insert({
                        "issueid": id,
                        "fileid": fileobj.uid,
                        "filename": fileobj.filename
                    });
                req.logger.log("debug", "created issue-file link for " + fileobj.uid);
            }
        }
        req.logger.log("debug", "successfully created issue`");
        res.redirect(vroot + "issues/" + id);
    }
});

module.exports = router;
