module.exports = function (app, connection, debug) {

    app.get("/kb/list/all", async function (req, res, next) {
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

    app.get("/kb/create", async function (req, res, next) {
        if (req.session.loginid === -1) res.redirect("/");
        else {
            res.render("kb/create");
        };
    });

    app.post("/kb/create", async function (req, res, next) {
        if (req.session.loginid === -1) {
            debug.issueapi("unprivileged user tried to create info page");
            res.redirect("/");
        } else if (typeof req.body.name !== typeof "string") {
            debug.issueapi("info page name of incorrect type");
            res.status(400).end();
        } else if (req.body.name === "") {
            debug.issueapi("info page name empty");
            res.redirect("/");
        } else if (typeof req.body.text !== typeof "string") {
            debug.issueapi("info page text of incorrect type");
            res.status(400).end();
        } else if (req.body.text === "") {
            debug.issueapi("info page text empty");
            res.redirect("/");
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
            res.redirect("/kb/" + id);
        }
    });

    app.get("/kb/post/:post/edit", async function (req, res, next) {
        if (req.user.id === -1) res.redirect("/");
        else if (typeof req.params.post !== typeof "") res.redirect("/");
        else if (isNaN(Number(req.params.post))) res.redirect("/");
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
                res.redirect("/");
            } else if (posts[0].authorid !== req.user.id) {
                res.redirect("/");
            } else
                res.render("editcomment", {
                    post: posts[0]
                });
        }
    });
    app.post("/kb/post/:post/edit", async function (req, res, next) {
        if (req.user.id === -1) res.redirect("/");
        else if (typeof req.params.post !== typeof "") res.status(400).end();
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
                res.redirect("/");
            } else if (posts[0].authorid !== req.user.id) {
                res.redirect("/");
            } else {
                await connection("infopagecomments")
                    .where({
                        "id": req.params.post
                    })
                    .update({
                        "containedtext": req.body.newtext,
                        "dateofedit": new Date()
                    })
                res.redirect("/kb/" + posts[0].infopageid + "#" + req.params.post);
            }
        }
    });

    app.get("/kb/tag/:tag/remove", async function (req, res, next) {
        if (req.user.id === -1) res.redirect("/");
        else if (typeof req.params.tag !== typeof "") res.redirect("/");
        else if (isNaN(Number(req.params.tag))) res.redirect("/");
        else {
            var tags = await connection
                .select("infopageid", "tagtext")
                .from("infopagetags")
                .where({
                    "id": req.params.tag
                })
            if (tags.length < 1) {
                res.redirect("/");
            } else {
                await connection("infopagetags")
                    .where({
                        "id": req.params.tag
                    })
                    .del()
                res.redirect("/kb/" + tags[0].infopageid);
            }
        }
    });
    app.get("/kb/:infopage/edit", async function (req, res, next) {
        if (req.user.id === -1) res.redirect("/");
        else if (typeof req.params.infopage !== typeof "") res.redirect("/");
        else if (isNaN(Number(req.params.infopage))) res.redirect("/");
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
                res.redirect("/");
            } else
                res.render("kb/edit", {
                    infopage: infopages[0]
                });
        }
    });
    app.post("/kb/:infopage/edit", async function (req, res, next) {
        if (req.user.id === -1) res.redirect("/");
        else if (typeof req.params.infopage !== typeof "") res.status(400).end();
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
                res.redirect("/");
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
                res.redirect("/kb/" + req.params.infopage);
            }
        }
    });
    app.get("/kb/:infopage/addtag", async function (req, res, next) {
        if (req.user.id === -1) {
            debug.issueapi("anonymous user trying to add tag");
            res.redirect("/");
        } else if (typeof req.params.infopage !== typeof "") {
            debug.issueapi("infopage id of incorrect type");
            res.redirect("/");
        } else if (isNaN(Number(req.params.infopage))) {
            debug.issueapi("infopage id is not identifier");
            res.redirect("/");
        } else if (typeof req.query.tagtext !== typeof "") {
            debug.issueapi("tag text of incorrect type");
            res.redirect("/");
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
            res.redirect("/kb/" + req.params.infopage);
        }
    });
    app.get("/kb/:infopage", async function (req, res, next) {
        if (isNaN(Number(req.params.infopage))) {
            debug.issueapi("infopage id is not identifier");
            res.redirect("/");
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

    app.get("/kb/:infopage/talk", async function (req, res, next) {
        if (isNaN(Number(req.params.infopage))) {
            debug.issueapi("infopage id is not identifier");
            res.redirect("/");
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

    app.post("/kb/:infopage", async function (req, res, next) {
        if (typeof req.params.infopage !== typeof "") res.redirect("/");
        else if (isNaN(Number(req.params.infopage))) res.redirect("/");
        else if (typeof req.body.text !== typeof "") res.status(400).end();
        else if (req.body.text === "") res.redirect("/");
        else {
            var id = (await connection("infopagecomments")
                .insert({
                    "containedtext": req.body.text,
                    "authorid": req.session.loginid,
                    "infopageid": req.params.infopage,
                    "dateofcreation": new Date()
                })
                .returning("id"))[0]
            res.redirect("/kb/" + req.params.infopage + "#" + id);
        }
    });
}