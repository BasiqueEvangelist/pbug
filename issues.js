var diff = require("diff");
var paginate = require("express-paginate");
module.exports = function (app, connection, debug) {

    const insertActivity = function (issueid, userid, data) {
        return connection("issueactivities")
            .insert({
                "dateofoccurance": new Date(),
                "issueid": issueid,
                "authorid": userid,
                "data": data
            });
    };
    app.get("/issues/search", paginate.middleware(), async function (req, res, next) {
        var query = (typeof req.query.q == "undefined") ? "" : req.query.q;
        function buildfrom(q, order) {
            var builder = connection
                .from("issues")
                .leftJoin("projects", "issues.projectid", "projects.id")
                .leftJoin("users AS assignees", "issues.assigneeid", "assignees.id")
                .leftJoin("users AS authors", "issues.authorid", "authors.id");
            var orderDesc = true;
            q.split(" ").forEach(function (d) {
                if (d.length == 0) { return; }
                else if (d[0] == "#") {
                    builder = builder.where(function (bld) {
                        bld.where("issues.issuetags", "ilike", d.slice(1) + "%")
                            .orWhere("issues.issuetags", "ilike", "%" + d.slice(1) + "%")
                            .orWhere("issues.issuetags", "ilike", "%" + d.slice(1));
                    });
                }
                else if (d.startsWith("status:")) {
                    var status = d.slice("status:");
                    if (status.match(/close/gi)) {
                        builder = builder.where("issues.isclosed", true)
                    }
                    else if (status.match(/open/gi)) {
                        builder = builder.where("issues.isclosed", false)
                    }
                }
                else if (d.startsWith("project:")) {
                    var projectCode = d.slice("project:".length);
                    builder = builder.where("projects.shortprojectid", "ilike", projectCode);
                }
                else if (d.startsWith("assignee:")) {
                    var assigneeName = d.slice("assignee:".length);
                    builder = builder.where("assignees.username", "ilike", assigneeName);
                }
                else if (d.startsWith("author:")) {
                    var authorName = d.slice("author:".length);
                    builder = builder.where("authors.username", "ilike", authorName);
                }
                else if (d.startsWith("order:")) {
                    var order = d.slice("order:".length);
                    if (order.match(/asc/gi))
                        orderDesc = false;
                }
                else {
                    builder = builder.where("issues.issuename", "ilike", "%" + d + "%");
                }
            });
            if (order)
                builder = builder.orderBy("issues.id", orderDesc ? "DESC" : "ASC");
            return builder;
        }
        var reslen = (await buildfrom(query, false).count("*"))[0].count;
        var results = await buildfrom(query, true)
            .select("issues.*", "projects.shortprojectid", "assignees.username", "authors.username")
            .offset(req.skip)
            .limit(req.query.limit);
        var pagec = Math.ceil(reslen / req.query.limit);
        res.render("issues/search",
            {
                query: query,
                results: results,
                pages: paginate.getArrayPages(req)(5, pagec, req.query.page)
            });
    })
    app.get("/issues/create", async function (req, res, next) {
        if (req.session.loginid === -1) {
            res.redirect("/");
            return;
        }
        res.render("issues/create", {
            projects: await connection
                .select("id", "projectname")
                .from("projects")
        });
    });

    app.post("/issues/create", async function (req, res, next) {
        if (req.session.loginid === -1) {
            debug.issueapi("unprivileged user tried to create issue");
            res.redirect("/");
        } else if (typeof req.body.name !== typeof "string") {
            debug.issueapi("issue name of incorrect type");
            res.status(400).end();
        } else if (req.body.name === "") {
            debug.issueapi("issue name empty");
            res.redirect("/");
        } else if (typeof req.body.firsttext !== typeof "string") {
            debug.issueapi("issue text (text of first post) of incorrect type");
            res.status(400).end();
        } else if (req.body.firsttext === "") {
            debug.issueapi("issue text (text of first post) empty");
            res.redirect("/");
        } else if (typeof req.body.projectid !== typeof "string") {
            debug.issueapi("issue project of incorrect type");
            res.status(400).end();
        } else if (isNaN(Number(req.body.projectid))) {
            debug.issueapi("issue project is not an identifier");
            res.status(400).end();
        } else {
            debug.issueapi("%s is creating issue", req.user.username);
            var id = (await connection("issues")
                .insert({
                    "issuename": req.body.name,
                    "projectid": Number(req.body.projectid),
                    "authorid": req.user.id
                })
                .returning("id"))[0];
            debug.issueapi("successfully created issue");
            await connection("issueposts")
                .insert({
                    "issueid": id,
                    "authorid": req.session.loginid,
                    "containedtext": req.body.firsttext,
                    "dateofcreation": new Date()
                })
            debug.issueapi("successfully created first post");
            res.redirect("/issues/" + id);
        }
    });

    app.get("/issues/:issue/activity", async function (req, res, next) {
        if (typeof req.params.issue !== typeof "") {
            debug.issueapi("issue id of incorrect type");
            res.redirect("/");
        } else if (isNaN(Number(req.params.issue))) {
            debug.issueapi("issue id is not identifier");
            res.redirect("/");
        } else {
            debug.issueapi("issue request for issue %s", req.params.issue);
            var issues = await connection
                .select("issues.id", "issues.issuename", "projects.shortprojectid", "issues.isclosed", "issues.assigneeid", "issues.issuetags", "users.fullname")
                .from("issues")
                .leftJoin("projects", "issues.projectid", "projects.id")
                .leftJoin("users", "issues.assigneeid", "users.id")
                .where({
                    "issues.id": Number(req.params.issue)
                });
            if (issues.length < 1) {
                debug.issueapi("issue %s not found", req.params.issue);
                res.status(404).render("404");
            } else {
                debug.issueapi("successfully retrieved issue");
                var users = await connection
                    .select("id", "fullname")
                    .from("users");
                debug.issueapi("successfully retrieved users");
                var activities = await connection
                    .select("issueactivities.id", "dateofoccurance",
                        "issueid", "authorid",
                        "data", "users.fullname")
                    .from("issueactivities")
                    .leftJoin("users", "issueactivities.authorid", "users.id")
                    .where({
                        "issueid": req.params.issue
                    })
                    .orderBy("id", "asc");
                debug.issueapi("successfully retrieved activity");
                var pactivities = await Promise.all(activities.map(async function (t) {
                    if (t.data.type === "assign") {
                        var oldfns = connection
                            .select("fullname")
                            .from("users")
                            .where({ id: t.data.oldassigneeid });
                        var newfns = connection
                            .select("fullname")
                            .from("users")
                            .where({ id: t.data.newassigneeid })
                        var newt = t;
                        if (oldfns.length === 1)
                            newt.oldfn = oldfns[0].fullname;
                        if (newfns.length === 1)
                            newt.newfn = newfns[0].fullname;
                        return newt;
                    }
                    else if (t.data.type === "editpost") {
                        t.oldtext = [];
                        t.newtext = [];
                        var da = diff.diffLines(t.data.from.text, t.data.to.text);
                        da.forEach(function (d, i) {
                            if (!d.removed && !d.added) {
                                t.oldtext.push([d.value, ""]);
                                t.newtext.push([d.value, ""]);
                            }
                            else if (d.removed) {
                                t.oldtext.push([d.value, "red"]);
                                if (i === da.length)
                                    t.newtext.push([" ", "filler"]);
                                else {
                                    if (!da[i + 1].added)
                                        t.newtext.push([" ", "filler"]);
                                }
                            }
                            else {
                                if (i === 0)
                                    t.oldtext.push([" ", "filler"]);
                                else {
                                    if (!da[i - 1].removed)
                                        t.oldtext.push([" ", "filler"]);
                                }
                                t.newtext.push([d.value, "green"]);
                            }
                        });
                        return t;
                    }
                    else {
                        return t;
                    }
                }));
                res.render("issues/viewactivity", {
                    issue: issues[0],
                    things: pactivities,
                    users: users
                });
            }
        }
    });
    app.get("/issues/:issue/posts", async function (req, res, next) {
        if (typeof req.params.issue !== typeof "") {
            debug.issueapi("issue id of incorrect type");
            res.redirect("/");
        } else if (isNaN(Number(req.params.issue))) {
            debug.issueapi("issue id is not identifier");
            res.redirect("/");
        } else {

            debug.issueapi("issue request for issue %s", req.params.issue);
            var issues = await connection
                .select("issues.*", "users.fullname", "projects.shortprojectid")
                .from("issues")
                .leftJoin("projects", "issues.projectid", "projects.id")
                .leftJoin("users", "issues.assigneeid", "users.id")
                .where({
                    "issues.id": Number(req.params.issue)
                })

            if (issues.length < 1) {
                debug.issueapi("issue %s not found", req.params.issue);
                res.status(404).render("404");
                return;
            }

            debug.issueapi("successfully retrieved issue");
            var posts = await connection
                .select("issueposts.*", "users.fullname")
                .from("issueposts")
                .leftJoin("users", "issueposts.authorid", "users.id")
                .where({
                    "issueposts.issueid": issues[0].id
                })
                .orderBy("issueposts.id", "asc");

            debug.issueapi("successfully retrieved issue posts");
            var users = await connection
                .select("id", "fullname")
                .from("users");

            debug.issueapi("successfully retrieved users");
            res.render("issues/viewtalk", {
                issue: issues[0],
                things: posts,
                users: users
            });
        }
    });
    app.get("/issues/:issue", async function (req, res) {
        res.redirect("/issues/" + req.params.issue + "/posts");
    });
    app.post("/issues/:issue", async function (req, res, next) {
        if (typeof req.params.issue !== typeof "") res.redirect("/");
        else if (isNaN(Number(req.params.issue))) res.redirect("/");
        else if (typeof req.body.text !== typeof "") res.status(400).end();
        else if (req.body.text === "") res.redirect("/");
        else {
            var ids = await connection("issueposts")
                .insert({
                    "containedtext": req.body.text,
                    "authorid": req.session.loginid,
                    "issueid": req.params.issue,
                    "dateofcreation": new Date()
                })
                .returning("id");
            await connection("issueactivities")
                .insert({
                    "authorid": req.session.loginid,
                    "issueid": req.params.issue,
                    "dateofoccurance": new Date(),
                    "data": {
                        type: "post",
                        text: req.body.text
                    }
                });
            res.redirect("/issues/" + req.params.issue + "/posts#" + ids[0]);
        }
    });
    app.get("/issues/:issue/open", async function (req, res, next) {
        if (typeof req.params.issue !== typeof "") {
            debug.issueapi("issue id of incorrect type");
            res.redirect("/");
        } else if (isNaN(Number(req.params.issue))) {
            debug.issueapi("issue id is not identifier");
            res.redirect("/");
        } else {
            debug.issueapi("open request for issue %s", req.params.issue);
            var results = await connection
                .select("assigneeid", "isclosed")
                .from("issues")
                .where({
                    "id": req.params.issue
                });
            if (req.user.id === results[0].assigneeid || req.user.isadmin) {
                debug.issueapi("opening issue %s", req.params.issue);
                await connection("issues")
                    .where({
                        "id": req.params.issue
                    })
                    .update({
                        "isclosed": false
                    });
                await connection("issueactivities")
                    .insert({
                        "dateofoccurance": new Date(),
                        "issueid": req.params.issue,
                        "authorid": req.user.id,
                        "data": {
                            type: "status",
                            newstatus: "open",
                            oldstatus: results.isclosed ? "closed" : "open"
                        }
                    });
                debug.issueapi("successfully opened issue %s", req.params.issue);
                res.redirect("/issues/" + req.params.issue + "/posts");
            } else {
                res.status(403);
                debug.issueapi("user is not privileged enough to open issue");
            }
        }
    });
    app.get("/issues/:issue/close", async function (req, res, next) {
        if (typeof req.params.issue !== typeof "") {
            debug.issueapi("issue id of incorrect type");
            res.redirect("/");
        } else if (isNaN(Number(req.params.issue))) {
            debug.issueapi("issue id is not identifier");
            res.redirect("/");
        } else {
            debug.issueapi("close request for issue %s", req.params.issue);
            var results = await connection
                .select("assigneeid", "isclosed")
                .from("issues")
                .where({
                    "id": req.params.issue
                })
            if (req.user.id === results[0].assigneeid || req.user.isadmin) {
                debug.issueapi("closing issue %s", req.params.issue);
                await connection("issues")
                    .where({
                        "id": req.params.issue
                    })
                    .update({
                        "isclosed": true
                    });
                await connection("issueactivities")
                    .insert({
                        "dateofoccurance": new Date(),
                        "issueid": req.params.issue,
                        "authorid": req.user.id,
                        "data": {
                            type: "status",
                            newstatus: "closed",
                            oldstatus: results[0].isclosed ? "closed" : "opened"
                        }
                    })
                debug.issueapi("successfully closed issue %s", req.params.issue);
                res.redirect("/issues/" + req.params.issue + "/posts");
            } else {
                debug.issueapi("user is not privileged enough to close issue");
            }
        }
    });
    app.get("/issues/:issue/delete/areyousure", async function (req, res) {
        res.render("areyousure");
    });
    app.get("/issues/:issue/delete", async function (req, res, next) {
        if (!req.user.isadmin) {
            debug.issueapi("non-admin user trying to delete issue");
            res.redirect("/");
        } else if (typeof req.params.issue !== typeof "") {
            debug.issueapi("issue id of incorrect type");
            res.redirect("/");
        } else if (isNaN(Number(req.params.issue))) {
            debug.issueapi("issue id is not identifier");
            res.redirect("/");
        } else {
            await connection("issueposts")
                .where({
                    "issueid": req.params.issue
                })
                .del()
            debug.issueapi("deleted all posts in issue %s", req.params.issue);
            await connection("issueactivities")
                .where({
                    "issueid": req.params.issue
                })
                .del();
            debug.issueapi("deleted all activity in issue %s", req.params.issue);
            await connection("issues")
                .where({
                    "id": req.params.issue
                })
                .del();
            debug.issueapi("deleted issue %s", req.params.issue);
            res.redirect("/issues");
        }
    });
    app.get("/issues/:issue/assign", async function (req, res, next) {
        if (req.user.id === -1) {
            debug.issueapi("anonymous user trying to assign");
            res.redirect("/");
        } else if (typeof req.params.issue !== typeof "") {
            debug.issueapi("issue id of incorrect type");
            res.redirect("/");
        } else if (isNaN(Number(req.params.issue))) {
            debug.issueapi("issue id is not identifier");
            res.redirect("/");
        } else if (typeof req.query.userid !== typeof "") {
            debug.issueapi("chosen assignee id of incorrect type");
            res.redirect("/");
        } else if (isNaN(Number(req.query.userid))) {
            debug.issueapi("chosen assignee  id is not identifier");
            res.redirect("/");
        } else {
            debug.issueapi("assign request for issue %s", req.params.issue);
            var issues = await connection
                .select("assigneeid")
                .from("issues")
                .where({
                    "id": req.params.issue
                });
            await connection("issues")
                .where({
                    "id": req.params.issue
                })
                .update({
                    "assigneeid": req.query.userid === "-1" ? null : req.query.userid
                })
            await connection("issueactivities")
                .insert({
                    "dateofoccurance": new Date(),
                    "issueid": req.params.issue,
                    "authorid": req.user.id,
                    "data": {
                        type: "assign",
                        newassigneeid: Number(req.query.userid),
                        oldassigneeid: issues[0].assigneeid === null ? -1 : issues[0].assigneeid
                    }
                })
            debug.issueapi("changed assignee for issue %s", req.params.issue);
            res.redirect("/issues/" + req.params.issue + "/posts");
        }
    });

    app.get("/issues/:issue/changetitle", async function (req, res, next) {
        if (req.user.id === -1) {
            debug.issueapi("anonymous user trying to change title");
            res.redirect("/");
        } else if (typeof req.params.issue !== typeof "") {
            debug.issueapi("issue id of incorrect type");
            res.redirect("/");
        } else if (isNaN(Number(req.params.issue))) {
            debug.issueapi("issue id is not identifier");
            res.redirect("/");
        } else if (typeof req.query.newtitle !== typeof "") {
            debug.issueapi("new title of incorrect type");
            res.redirect("/");
        } else if (req.query.newtitle === "") {
            debug.issueapi("new title empty");
            res.redirect("back");
        } else {
            debug.issueapi("changetitle request for issue %s", req.params.issue);

            var issues = await connection
                .select("issuename")
                .from("issues")
                .where({ "id": req.params.issue });

            await connection("issues")
                .where({ "id": req.params.issue })
                .update({ "issuename": req.query.newtitle });

            await insertActivity(req.params.issue, req.user.id, {
                type: "changetitle",
                newtitle: req.query.newtitle,
                oldtitle: issues[0].issuename
            });

            debug.issueapi("changed title for issue %s", req.params.issue);
            res.redirect("/issues/" + req.params.issue + "/posts");
        }
    });

    app.get("/issues/post/:post/edit", async function (req, res, next) {
        if (req.user.id === -1) res.redirect("/");
        else if (typeof req.params.post !== typeof "") res.redirect("/");
        else if (isNaN(Number(req.params.post))) res.redirect("/");
        else {
            var posts = await connection
                .select("issueposts.*", "users.fullname")
                .from("issueposts")
                .leftJoin("users", "issueposts.authorid", "users.id")
                .where({
                    "issueposts.id": req.params.post
                });
            if (posts.length < 1)
                res.redirect("/");
            else if (posts[0].authorid !== req.user.id)
                res.redirect("/");
            else {
                console.log(await connection
                    .select("issueposts.id")
                    .from("issueposts")
                    .where({
                        "issueposts.issueid": posts[0].issueid
                    })
                    .first())
                var isfirst = (await connection
                    .select("issueposts.id")
                    .from("issueposts")
                    .where({
                        "issueposts.issueid": posts[0].issueid
                    })
                    .first()).id == Number(req.params.post);
                if (isfirst)
                    res.render("issues/editpost", {
                        post: posts[0],
                        tags: (await connection.select("issues.issuetags")
                            .from("issues")
                            .where({
                                "id": posts[0].issueid
                            }))[0].issuetags
                    });
                else
                    res.render("issues/editpost", {
                        post: posts[0]
                    });
            }
        }
    });

    app.post("/issues/post/:post/edit", async function (req, res, next) {
        if (req.user.id === -1) res.redirect("/");
        else if (typeof req.params.post !== typeof "") res.status(400).end();
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
            var tags = (await connection
                .select("issuetags")
                .from("issues")
                .where({
                    "id": posts[0].issueid
                }))[0].issuetags
            if (posts.length < 1) {
                res.redirect("/");
            } else if (posts[0].authorid !== req.user.id) {
                res.redirect("/");
            } else {
                await connection("issueposts")
                    .where({
                        "id": req.params.post
                    })
                    .update({
                        "containedtext": req.body.newtext,
                        // "issuetags": req.body.newtags,
                        "dateofedit": new Date()
                    });
                await connection("issues")
                    .where({
                        "id": posts[0].issueid
                    })
                    .update({
                        "issuetags": req.body.newtags
                    });
                await connection("issueactivities")
                    .insert({
                        "authorid": req.user.id,
                        "issueid": posts[0].issueid,
                        "dateofoccurance": new Date(),
                        "data": {
                            type: "editpost",
                            postid: req.params.post,
                            from: {
                                text: posts[0].containedtext,
                                tags: tags
                            },
                            to: {
                                text: req.body.newtext,
                                tags: req.body.newtags
                            }

                        }
                    });
                res.redirect("/issues/" + posts[0].issueid + "/posts#" + req.params.post);
            }
        }
    });

}