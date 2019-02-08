var { requiresLogin } = require("./common")
module.exports = function (app, connection, debug, config) {
    var vroot = config["virtual-root"];
    app.get(vroot + "kb/list/all", async function (req, res, next) {
        debug.issueapi("showing all kb pages");
        var results = await connection
            .select("infopages.id", "infopages.pagename")
            .from("infopages")
            .orderBy("infopages.id", "desc")
        debug.issueapi("kb pages retrieved, sending body");
        res.render("kb/listall", {
            kbs: results
        });
    });

    app.get(vroot + "kb/create", requiresLogin, async function (req, res, next) {
        res.render("kb/create");
    });

    app.post(vroot + "kb/create", requiresLogin, async function (req, res, next) {
        if (typeof req.body.name !== typeof "string") {
            debug.issueapi("info page name of incorrect type");
            res.status(400).end();
        } else if (req.body.name === "") {
            debug.issueapi("info page name empty");
            res.redirect(vroot);
        } else if (typeof req.body.text !== typeof "string") {
            debug.issueapi("info page text of incorrect type");
            res.status(400).end();
        } else if (req.body.text === "") {
            debug.issueapi("info page text empty");
            res.redirect(vroot);
        } else {
            debug.issueapi("%s is creating info page", req.user.username);
            var id = (await connection("infopages")
                .insert({
                    "pagename": req.body.name,
                    "authorid": req.user.id,
                    "editorid": req.user.id,
                    "containedtext": req.body.text,
                    "dateofcreation": new Date(),
                    "dateofedit": new Date()
                })
                .returning("id"))[0]
            debug.issueapi("successfully created infopage");
            res.redirect(vroot + "kb/" + id);
        }
    });

    app.get(vroot + "kb/post/:post/edit", async function (req, res, next) {
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
    app.post(vroot + "kb/post/:post/edit", requiresLogin, async function (req, res, next) {
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

    app.get(vroot + "kb/tag/:tag/remove", requiresLogin, async function (req, res, next) {
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
    app.get(vroot + "kb/:infopage/edit", requiresLogin, async function (req, res, next) {
        if (typeof req.params.infopage !== typeof "") res.redirect(vroot);
        else if (isNaN(Number(req.params.infopage))) res.redirect(vroot);
        else {
            var infopages = await connection
                .select("infopages.id", "infopages.containedtext", "infopages.authorid",
                    "infopages.dateofcreation", "infopages.dateofedit", "infopages.pagename",
                    "users.fullname")
                .from("infopages")
                .leftJoin("users", "infopages.authorid", "users.id")
                .where({
                    "infopages.id": req.params.infopage
                })
            if (infopages.length < 1) {
                res.redirect(vroot);
            } else
                res.render("kb/edit", {
                    infopage: infopages[0]
                });
        }
    });
    app.post(vroot + "kb/:infopage/edit", requiresLogin, async function (req, res, next) {
        if (typeof req.params.infopage !== typeof "") res.status(400).end();
        else if (isNaN(Number(req.params.infopage))) res.status(400).end();
        else if (typeof req.body.newtext !== typeof "") res.status(400).end();
        else if (req.body.newtext === "") res.redirect("back");
        else if (typeof req.body.newtitle !== typeof "") res.status(400).end();
        else if (req.body.newtitle === "") res.redirect("back");
        else {
            var infopages = await connection
                .select("authorid")
                .from("infopages")
                .where({
                    "id": req.params.infopage
                })
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
                        "dateofedit": new Date()
                    })
                res.redirect(vroot + "kb/" + req.params.infopage);
            }
        }
    });
    app.get(vroot + "kb/:infopage/addtag", requiresLogin, async function (req, res, next) {
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
    app.get(vroot + "kb/:infopage", async function (req, res, next) {
        if (isNaN(Number(req.params.infopage))) {
            debug.issueapi("infopage id is not identifier");
            res.redirect(vroot);
            return;
        }
        debug.issueapi("infopage request for infopage %s", req.params.infopage);
        var infopages = await connection
            .select("infopages.*", "users.fullname")
            .from("infopages")
            .leftJoin("users", "infopages.authorid", "users.id")
            .where({
                "infopages.id": Number(req.params.infopage)
            })
        if (infopages.length < 1) {
            debug.issueapi("infopage %s not found", req.params.infopage);
            res.status(404).render("404");
            return;
        }
        debug.issueapi("successfully retrieved kb");
        var comments = awaitconnection
            .select("infopagecomments.*", "users.fullname")
            .from("infopagecomments")
            .leftJoin("users", "infopagecomments.authorid", "users.id")
            .where({
                "infopagecomments.infopageid": req.params.infopage
            })
            .orderBy("infopagecomments.id", "asc")
        debug.issueapi("successfully retrieved infopage posts");
        var tags = await connection
            .select("id", "tagtext")
            .from("infopagetags")
            .where({
                "infopageid": req.params.infopage
            })
        res.render("kb/view", {
            infopage: infopages[0],
            comments: comments,
            tags: tags,
        });

    });

    app.get(vroot + "kb/:infopage/talk", async function (req, res, next) {
        if (isNaN(Number(req.params.infopage))) {
            debug.issueapi("infopage id is not identifier");
            res.redirect(vroot);
            return;
        }
        debug.issueapi("infopage request for infopage %s", req.params.infopage);
        var infopages = await connection
            .select("infopages.id", "infopages.pagename")
            .from("infopages")
            .where({
                "infopages.id": Number(req.params.infopage)
            })
        if (infopages.length < 1) {
            debug.issueapi("infopage %s not found", req.params.infopage);
            res.status(404).render("404");
            return;
        }
        debug.issueapi("successfully retrieved kb");
        var comments = await connection
            .select("infopagecomments.*", "users.fullname")
            .from("infopagecomments")
            .leftJoin("users", "infopagecomments.authorid", "users.id")
            .where({
                "infopagecomments.infopageid": req.params.infopage
            })
            .orderBy("infopagecomments.id", "asc")
        res.render("kb/talk", {
            infopage: infopages[0],
            comments: comments
        });
    });

    app.post(vroot + "kb/:infopage", async function (req, res, next) {
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
}