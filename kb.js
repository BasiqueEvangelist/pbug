module.exports = function (app, connection, debug) {

    app.get("/kb/list/all", function (req, res, next) {
        debug.issueapi("showing all kb pages");
        connection
            .select("infopages.id", "infopages.pagename")
            .from("infopages")
            .orderBy("infopages.id", "desc")
            .then(function (results) {
                debug.issueapi("kb pages retrieved, sending body");
                res.render("kb/listall", {
                    kbs: results
                });
            });
    });

    app.get("/kb/create", function (req, res, next) {
        if (req.session.loginid === -1) res.redirect("/");
        else {
            res.render("kb/create");
        };
    });

    app.post("/kb/create", function (req, res, next) {
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
            connection("infopages")
                .insert({
                    "pagename": req.body.name,
                    "authorid": req.user.id,
                    "editorid": req.user.id,
                    "containedtext": req.body.text,
                    "dateofcreation": new Date(),
                    "dateofedit": new Date()
                })
                .returning("id")
                .then(function (ids) {
                    debug.issueapi("successfully created infopage");
                    res.redirect("/kb/" + ids[0]);
                });
        }
    });

    app.get("/kb/post/:post/edit", function (req, res, next) {
        if (req.user.id === -1) res.redirect("/");
        else if (typeof req.params.post !== typeof "") res.redirect("/");
        else if (isNaN(Number(req.params.post))) res.redirect("/");
        else {
            connection
                .select("infopagecomments.id", "infopagecomments.containedtext", "infopagecomments.authorid",
                    "infopagecomments.dateofcreation", "infopagecomments.dateofedit", "users.fullname")
                .from("infopagecomments")
                .leftJoin("users", "infopagecomments.authorid", "users.id")
                .where({
                    "infopagecomments.id": req.params.post
                })
                .then(function (posts) {
                    if (posts.length < 1) {
                        res.redirect("/");
                    } else if (posts[0].authorid !== req.user.id) {
                        res.redirect("/");
                    } else
                        res.render("editcomment", {
                            post: posts[0]
                        });
                });
        }
    });
    app.post("/kb/post/:post/edit", function (req, res, next) {
        if (req.user.id === -1) res.redirect("/");
        else if (typeof req.params.post !== typeof "") res.status(400).end();
        else if (isNaN(Number(req.params.post))) res.status(400).end();
        else if (typeof req.body.newtext !== typeof "") res.status(400).end();
        else if (req.body.newtext === "") res.redirect("back");
        else {
            connection
                .select("authorid", "infopageid")
                .from("infopagecomments")
                .where({
                    "id": req.params.post
                })
                .then(function (posts) {
                    if (posts.length < 1) {
                        res.redirect("/");
                    } else if (posts[0].authorid !== req.user.id) {
                        res.redirect("/");
                    } else {
                        connection("infopagecomments")
                            .where({
                                "id": req.params.post
                            })
                            .update({
                                "containedtext": req.body.newtext,
                                "dateofedit": new Date()
                            })
                            .then(function () {
                                res.redirect("/kb/" + posts[0].infopageid + "#" + req.params.post);
                            });
                    }
                });
        }
    });

    app.get("/kb/tag/:tag/remove", function (req, res, next) {
        if (req.user.id === -1) res.redirect("/");
        else if (typeof req.params.tag !== typeof "") res.redirect("/");
        else if (isNaN(Number(req.params.tag))) res.redirect("/");
        else {
            connection
                .select("infopageid", "tagtext")
                .from("infopagetags")
                .where({
                    "id": req.params.tag
                })
                .then(function (tags) {
                    if (tags.length < 1) {
                        res.redirect("/");
                    } else
                        connection("infopagetags")
                            .where({
                                "id": req.params.tag
                            })
                            .del()
                            .then(function () {
                                res.redirect("/kb/" + tags[0].infopageid);
                            });
                });
        }
    });
    app.get("/kb/:infopage/edit", function (req, res, next) {
        if (req.user.id === -1) res.redirect("/");
        else if (typeof req.params.infopage !== typeof "") res.redirect("/");
        else if (isNaN(Number(req.params.infopage))) res.redirect("/");
        else {
            connection
                .select("infopages.id", "infopages.containedtext", "infopages.authorid",
                    "infopages.dateofcreation", "infopages.dateofedit", "infopages.pagename",
                    "users.fullname")
                .from("infopages")
                .leftJoin("users", "infopages.authorid", "users.id")
                .where({
                    "infopages.id": req.params.infopage
                })
                .then(function (infopages) {
                    if (infopages.length < 1) {
                        res.redirect("/");
                    } else
                        res.render("kb/edit", {
                            infopage: infopages[0]
                        });
                });
        }
    });
    app.post("/kb/:infopage/edit", function (req, res, next) {
        if (req.user.id === -1) res.redirect("/");
        else if (typeof req.params.infopage !== typeof "") res.status(400).end();
        else if (isNaN(Number(req.params.infopage))) res.status(400).end();
        else if (typeof req.body.newtext !== typeof "") res.status(400).end();
        else if (req.body.newtext === "") res.redirect("back");
        else if (typeof req.body.newtitle !== typeof "") res.status(400).end();
        else if (req.body.newtitle === "") res.redirect("back");
        else {
            connection
                .select("authorid")
                .from("infopages")
                .where({
                    "id": req.params.infopage
                })
                .then(function (infopages) {
                    if (infopages.length < 1) {
                        res.redirect("/");
                    } else {
                        connection("infopages")
                            .where({
                                "id": req.params.infopage
                            })
                            .update({
                                "containedtext": req.body.newtext,
                                "pagename": req.body.newtitle,
                                "dateofedit": new Date()
                            })
                            .then(function () {
                                res.redirect("/kb/" + req.params.infopage);
                            });
                    }
                });
        }
    });
    app.get("/kb/:infopage/addtag", function (req, res, next) {
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
            connection("infopagetags")
                .insert({
                    "tagtext": req.query.tagtext,
                    "infopageid": req.params.infopage
                })
                .then(function () {
                    debug.issueapi("added tag to infopage %s", req.params.infopage);
                    res.redirect("/kb/" + req.params.infopage);
                });
        }
    });
    app.get("/kb/:infopage", function (req, res, next) {
        if (isNaN(Number(req.params.infopage))) {
            debug.issueapi("infopage id is not identifier");
            res.redirect("/");
            return;
        }
        debug.issueapi("infopage request for infopage %s", req.params.infopage);
        connection
            .select("infopages.*", "users.fullname")
            .from("infopages")
            .leftJoin("users", "infopages.authorid", "users.id")
            .where({
                "infopages.id": Number(req.params.infopage)
            })
            .then(function (infopages) {
                if (infopages.length < 1) {
                    debug.issueapi("infopage %s not found", req.params.infopage);
                    res.status(404).render("404");
                    return;
                }
                debug.issueapi("successfully retrieved kb");
                connection
                    .select("infopagecomments.*", "users.fullname")
                    .from("infopagecomments")
                    .leftJoin("users", "infopagecomments.authorid", "users.id")
                    .where({
                        "infopagecomments.infopageid": req.params.infopage
                    })
                    .orderBy("infopagecomments.id", "asc")
                    .then(function (comments) {
                        debug.issueapi("successfully retrieved infopage posts");
                        connection
                            .select("id", "tagtext")
                            .from("infopagetags")
                            .where({
                                "infopageid": req.params.infopage
                            })
                            .then(function (tags) {
                                res.render("kb/view", {
                                    infopage: infopages[0],
                                    comments: comments,
                                    tags: tags,
                                });
                            });

                    });
            });
    });

    app.get("/kb/:infopage/talk", function (req, res, next) {
        if (isNaN(Number(req.params.infopage))) {
            debug.issueapi("infopage id is not identifier");
            res.redirect("/");
            return;
        }
        debug.issueapi("infopage request for infopage %s", req.params.infopage);
        connection
            .select("infopages.id", "infopages.pagename")
            .from("infopages")
            .where({
                "infopages.id": Number(req.params.infopage)
            })
            .then(function (infopages) {
                if (infopages.length < 1) {
                    debug.issueapi("infopage %s not found", req.params.infopage);
                    res.status(404).render("404");
                    return;
                }
                debug.issueapi("successfully retrieved kb");
                connection
                    .select("infopagecomments.*", "users.fullname")
                    .from("infopagecomments")
                    .leftJoin("users", "infopagecomments.authorid", "users.id")
                    .where({
                        "infopagecomments.infopageid": req.params.infopage
                    })
                    .orderBy("infopagecomments.id", "asc")
                    .then(function (comments) {
                        res.render("kb/talk", {
                            infopage: infopages[0],
                            comments: comments
                        });
                    });

            });
    });

    app.post("/kb/:infopage", function (req, res, next) {
        if (typeof req.params.infopage !== typeof "") res.redirect("/");
        else if (isNaN(Number(req.params.infopage))) res.redirect("/");
        else if (typeof req.body.text !== typeof "") res.status(400).end();
        else if (req.body.text === "") res.redirect("/");
        else {
            connection("infopagecomments")
                .insert({
                    "containedtext": req.body.text,
                    "authorid": req.session.loginid,
                    "infopageid": req.params.infopage,
                    "dateofcreation": new Date()
                })
                .returning("id")
                .then(function (ids) {
                    res.redirect("/kb/" + req.params.infopage + "#" + ids[0]);
                });
        }
    });
}