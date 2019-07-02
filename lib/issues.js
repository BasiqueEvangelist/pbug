var diff = require("diff");
var paginate = require("express-paginate");
var { requiresLogin, catchFiles } = require("./common");
module.exports = function (app, connection, debug, config) {
    var vroot = config["virtual-root"];
    const insertActivity = function (issueid, userid, data) {
        return connection("issueactivities")
            .insert({
                "dateofoccurance": new Date(),
                "issueid": issueid,
                "authorid": userid,
                "data": JSON.stringify(data)
            });
    };
    app.get(vroot + "issues", async function (req, res) {
        res.redirect(vroot + "issues/search");
    });
    app.get(vroot + "issues/search", paginate.middleware(), async function (req, res, next) {
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
                    if (assigneeName === "me" && req.user.id !== -1)
                        builder = builder.where("assignees.id", req.user.id);
                    else if (assigneeName === "none")
                        builder = builder.where("issues.assigneeid", null);
                    else
                        builder = builder.where("assignees.username", "ilike", assigneeName);
                }
                else if (d.startsWith("author:")) {
                    var authorName = d.slice("author:".length);
                    if (authorName == "me" && req.user.id !== -1)
                        builder = builder.where("authors.id", req.user.id);
                    else
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
            .select({
                "shortprojectid": "projects.shortprojectid",
                "assigneename": "assignees.username",
                "authorname": "authors.username"
            })
            .select("issues.*")
            .offset(req.skip)
            .limit(req.query.limit);
        var pagec = Math.ceil(reslen / req.query.limit);
        res.render("issues/search",
            {
                query: query,
                results: results,
                pages: paginate.getArrayPages(req)(5, pagec, req.query.page),
                pagec: Math.ceil(reslen / req.query.limit)
            });
    })
    app.get(vroot + "issues/create", requiresLogin, async function (req, res, next) {
        res.render("issues/create", {
            projects: await connection
                .select("id", "projectname")
                .from("projects"),
            users: await connection
                .select("id", "fullname")
                .from("users")
        });
    });

    app.post(vroot + "issues/create", catchFiles(), async function (req, res, next) {
        if (typeof req.body.name !== typeof "string") {
            debug.issueapi("issue name of incorrect type");
            res.status(400).end();
        } else if (req.body.name === "") {
            debug.issueapi("issue name empty");
            res.redirect(vroot);
        } else if (typeof req.body.firsttext !== typeof "string") {
            debug.issueapi("issue text (text of first post) of incorrect type");
            res.status(400).end();
        } else if (req.body.firsttext === "") {
            debug.issueapi("issue text (text of first post) empty");
            res.redirect(vroot);
        } else if (typeof req.body.projectid !== typeof "string") {
            debug.issueapi("issue project of incorrect type");
            res.status(400).end();
        } else if (isNaN(Number(req.body.projectid))) {
            debug.issueapi("issue project is not an identifier");
            res.status(400).end();
        } else if (typeof req.body.tags !== typeof "string") {
            debug.issueapi("issue tags of incorrect type");
            res.status(400).end();
        } else if (typeof req.body.assigneeid !== typeof "string") {
            debug.issueapi("issue assignee id of incorrect type");
            res.status(400).end();
        } else if (isNaN(Number(req.body.assigneeid))) {
            debug.issueapi("issue assignee id is not an identifier");
            res.status(400).end();
        } else {
            debug.issueapi("%s is creating issue", req.user.username);
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
            await insertActivity(id,req.user.id, {
                type: "createissue",
                text: req.body.firsttext,
                tags: req.body.tags,
                title: req.body.name
            });
            for (var filefield in req.files) {
                await connection("issuefiles")
                    .insert({
                        "issueid": id,
                        "fileid": req.files[filefield].uid,
                        "filename": req.files[filefield].filename
                    });
                debug.issueapi("created issue-file link for " + req.files[filefield]);
            }
            debug.issueapi("successfully created issue`");
            res.redirect(vroot + "issues/" + id);
        }
    });

    app.get(vroot + "issues/:issue/activity", async function (req, res, next) {
        if (typeof req.params.issue !== typeof "") {
            debug.issueapi("issue id of incorrect type");
            res.redirect(vroot);
        } else if (isNaN(Number(req.params.issue))) {
            debug.issueapi("issue id is not identifier");
            res.redirect(vroot);
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
                var activities = (await connection
                    .select("issueactivities.id", "dateofoccurance",
                        "issueid", "authorid",
                        "data", "users.fullname")
                    .from("issueactivities")
                    .leftJoin("users", "issueactivities.authorid", "users.id")
                    .where({
                        "issueid": req.params.issue
                    })
                    .orderBy("id", "asc")).map(function (a) {
                        a.data = JSON.parse(a.data);
                        return a;
                    });
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
                    else if (t.data.type === "editpost" || t.data.type === "editissue") {
                        t.oldtext = [];
                        t.newtext = [];
                        var da = diff.diffLines(t.data.from.text, t.data.to.text);
                        da.forEach(function (d, i) {
                            if (typeof d.added === typeof undefined) d.added = false;
                            if (typeof d.removed === typeof undefined) d.removed = false;
                            if (!d.removed && !d.added) {
                                t.oldtext.push([d.value, ""]);
                                t.newtext.push([d.value, ""]);
                            }
                            else if (d.removed) {
                                t.oldtext.push([d.value, "red"]);
                                if (i === da.length - 1)
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
    app.get(vroot + "issues/:issue/posts", async function (req, res, next) {
        if (typeof req.params.issue !== typeof "") {
            debug.issueapi("issue id of incorrect type");
            res.redirect(vroot);
        } else if (isNaN(Number(req.params.issue))) {
            debug.issueapi("issue id is not identifier");
            res.redirect(vroot);
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
            var files = await connection
                .select("fileid", "filename")
                .from("issuefiles")
                .where({
                    "issueid": issues[0].id
                });

            debug.issueapi("successfully retrieved issuefiles");
            res.render("issues/viewtalk", {
                issue: issues[0],
                things: posts,
                users: users,
                files: files
            });
        }
    });
    app.get(vroot + "issues/:issue", async function (req, res) {
        res.redirect(vroot + "issues/" + req.params.issue + "/posts");
    });
    app.post(vroot + "issues/:issue", async function (req, res, next) {
        if (typeof req.params.issue !== typeof "") res.redirect(vroot);
        else if (isNaN(Number(req.params.issue))) res.redirect(vroot);
        else if (typeof req.body.text !== typeof "") res.status(400).end();
        else if (req.body.text === "") res.redirect(vroot);
        else {
            var ids = await connection("issueposts")
                .insert({
                    "containedtext": req.body.text,
                    "authorid": req.session.loginid,
                    "issueid": req.params.issue,
                    "dateofcreation": new Date()
                })
                .returning("id");
            await insertActivity(req.params.issue, req.user.id, {
                type: "post",
                text: req.body.text
            });
            res.redirect(vroot + "issues/" + req.params.issue + "/posts#" + ids[0]);
        }
    });
    app.get(vroot + "issues/:issue/open", async function (req, res, next) {
        if (typeof req.params.issue !== typeof "") {
            debug.issueapi("issue id of incorrect type");
            res.redirect(vroot);
        } else if (isNaN(Number(req.params.issue))) {
            debug.issueapi("issue id is not identifier");
            res.redirect(vroot);
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
                await insertActivity(req.params.issue, req.user.id, {
                        type: "status",
                        newstatus: "open",
                        oldstatus: results.isclosed ? "closed" : "open"
                });
                debug.issueapi("successfully opened issue %s", req.params.issue);
                res.redirect(vroot + "issues/" + req.params.issue + "/posts");
            } else {
                res.status(403);
                debug.issueapi("user is not privileged enough to open issue");
            }
        }
    });
    app.get(vroot + "issues/:issue/close", async function (req, res, next) {
        if (typeof req.params.issue !== typeof "") {
            debug.issueapi("issue id of incorrect type");
            res.redirect(vroot);
        } else if (isNaN(Number(req.params.issue))) {
            debug.issueapi("issue id is not identifier");
            res.redirect(vroot);
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
                await insertActivity(req.params.issue, req.user.id, {
                    type: "status",
                    newstatus: "closed",
                    oldstatus: results[0].isclosed ? "closed" : "opened"
                });
                debug.issueapi("successfully closed issue %s", req.params.issue);
                res.redirect(vroot + "issues/" + req.params.issue + "/posts");
            } else {
                debug.issueapi("user is not privileged enough to close issue");
            }
        }
    });
    app.get(vroot + "issues/:issue/delete/areyousure", async function (req, res) {
        res.render("areyousure");
    });
    app.get(vroot + "issues/:issue/delete", async function (req, res, next) {
        if (!req.user.isadmin) {
            debug.issueapi("non-admin user trying to delete issue");
            res.redirect(vroot);
        } else if (typeof req.params.issue !== typeof "") {
            debug.issueapi("issue id of incorrect type");
            res.redirect(vroot);
        } else if (isNaN(Number(req.params.issue))) {
            debug.issueapi("issue id is not identifier");
            res.redirect(vroot);
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
            res.redirect(vroot + "issues");
        }
    });
    app.get(vroot + "issues/:issue/assign", requiresLogin, async function (req, res, next) {
        if (typeof req.params.issue !== typeof "") {
            debug.issueapi("issue id of incorrect type");
            res.redirect(vroot);
        } else if (isNaN(Number(req.params.issue))) {
            debug.issueapi("issue id is not identifier");
            res.redirect(vroot);
        } else if (typeof req.query.userid !== typeof "") {
            debug.issueapi("chosen assignee id of incorrect type");
            res.redirect(vroot);
        } else if (isNaN(Number(req.query.userid))) {
            debug.issueapi("chosen assignee  id is not identifier");
            res.redirect(vroot);
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
            await insertActivity(req.params.issue, req.user.id, {
                type: "assign",
                newassigneeid: Number(req.query.userid),
                oldassigneeid: issues[0].assigneeid === null ? -1 : issues[0].assigneeid
            });
            debug.issueapi("changed assignee for issue %s", req.params.issue);
            res.redirect(vroot + "issues/" + req.params.issue + "/posts");
        }
    });

    app.get(vroot + "issues/post/:post/edit", requiresLogin, async function (req, res, next) {
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

    app.post(vroot + "issues/post/:post/edit", catchFiles(), async function (req, res, next) {
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
    app.get(vroot + "issues/:issue/edit", requiresLogin, async function (req, res, next) {
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
    app.post(vroot + "issues/:issue/edit", catchFiles(), async function (req, res, next) {
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
}
