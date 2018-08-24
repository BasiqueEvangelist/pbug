require("dotenv").config();
var express = require("express");
var session = require("express-session");
var sha512 = require("sha512");
var compression = require("compression");
var Knex = require("knex");
var errors = require("./errors");
var debug = {};
debug.all = require("debug")("pbug*");
debug.request = require("debug")("pbug:request");
debug.userapi = require("debug")("pbug:userapi");
debug.issueapi = require("debug")("pbug:issueapi");
var markdown = require("markdown").markdown;
debug.all("starting pbug");
var connection = new Knex({
    client: process.env.DB_TYPE,
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_DB
    }
});
var KnexStore = require("connect-session-knex")(session);
var app = express();
// app.use(compression());
app.use(session({
    name: "pbug.sid",
    secret: "pbugpbugpbugpbug",
    resave: true,
    saveUninitialized: false,
    store: new KnexStore({
        knex: connection
    })
}));
app.locals.parseMarkdown = function (markd) {
    var htmlr = markdown.toHTML(markd);
    return htmlr;
};
app.use(function (req, res, next) {
    debug.request("(%s) %s %s - %s", req.connection.remoteAddress, req.method, req.path, req.headers["user-agent"]);
    if (typeof req.session.loginid === typeof undefined) req.session.loginid = -1;
    if (req.session.loginid === -1) req.session.loginadmin = false;
    req.user = {};
    req.user.id = req.session.loginid;
    req.user.isadmin = req.session.loginadmin;
    req.user.fullname = req.session.loginfullname;
    req.user.username = req.session.loginusername;
    res.locals.req = req;
    res.locals.errors = errors;
    next();
});
app.use(express.urlencoded({
    extended: false
}));
app.use("/static", express.static("static"));
app.set("view engine", "pug");
app.get("/", function (req, res, next) {
    if (req.user.id === -1) {
        debug.issueapi("showing all open issues");
        connection
            .select("issues.id", "issues.issuename", "issues.isclosed", "projects.shortprojectid")
            .from("issues")
            .leftJoin("projects", "issues.projectid", "projects.id")
            .where({
                "issues.isclosed": false
            })
            .orderBy("issues.id", "desc")
            .then(function (results) {
                debug.issueapi("issues retrieved, sending body");
                res.render("listissues", {
                    issues: results,
                    title: "List of open issues"
                });
            });
    } else {
        debug.issueapi("showing all open issues assigned to %s", req.user.username);
        connection
            .select("issues.id", "issues.issuename", "issues.isclosed", "projects.shortprojectid")
            .from("issues")
            .leftJoin("projects", "issues.projectid", "projects.id")
            .where({
                "issues.isclosed": false,
                "issues.assigneeid": req.user.id
            })
            .orderBy("issues.id", "desc")
            .then(function (results) {
                debug.issueapi("retrieving issues authored by user");
                connection
                    .select("issues.id", "issues.issuename", "issues.isclosed", "projects.shortprojectid")
                    .from("issues")
                    .leftJoin("projects", "issues.projectid", "projects.id")
                    .where({
                        "issues.isclosed": false,
                        "issues.authorid": req.user.id
                    })
                    .orderBy("issues.id", "desc")
                    .then(function (aresults) {
                        debug.issueapi("issues retrieved, sending body");
                        res.render("listissues", {
                            issues: results,
                            aissues: aresults,
                            title: "List of open issues assigned to you"
                        });
                    });
            });
    }
});
app.get("/issues", function (req, res) {
    res.redirect("/issues/open");
});
app.get("/issues/open", function (req, res, next) {
    debug.issueapi("showing all open issues");
    connection
        .select("issues.id", "issues.issuename", "issues.isclosed", "projects.shortprojectid")
        .from("issues")
        .leftJoin("projects", "issues.projectid", "projects.id")
        .where({
            "issues.isclosed": false
        })
        .orderBy("issues.id", "desc")
        .then(function (results) {
            debug.issueapi("issues retrieved, sending body");
            res.render("listissuesopen", {
                issues: results
            });
        });
});
app.get("/issues/all", function (req, res, next) {
    debug.issueapi("showing all issues");
    connection
        .select("issues.id", "issues.issuename", "issues.isclosed", "projects.shortprojectid")
        .from("issues")
        .leftJoin("projects", "issues.projectid", "projects.id")
        .orderBy("issues.id", "desc")
        .then(function (results) {
            debug.issueapi("issues retrieved, sending body");
            res.render("listissuesall", {
                issues: results
            });
        });
});
app.get("/issues/orphan", function (req, res, next) {
    debug.issueapi("showing all orphan issues");
    connection
        .select("issues.id", "issues.issuename", "issues.isclosed", "projects.shortprojectid")
        .from("issues")
        .leftJoin("projects", "issues.projectid", "projects.id")
        .where({
            "issues.isclosed": false,
            "issues.assigneeid": null
        })
        .orderBy("issues.id", "desc")
        .then(function (results) {
            debug.issueapi("issues retrieved, sending body");
            res.render("listissuesorphan", {
                issues: results
            });
        });
});
app.get("/issues/completed", function (req, res, next) {
    debug.issueapi("showing all completed issues");
    connection
        .select("issues.id", "issues.issuename", "issues.isclosed", "projects.shortprojectid")
        .from("issues")
        .leftJoin("projects", "issues.projectid", "projects.id")
        .where({
            "issues.isclosed": true
        })
        .orderBy("issues.id", "desc")
        .then(function (results) {
            debug.issueapi("issues retrieved, sending body");
            res.render("listissuescompleted", {
                issues: results
            });
        });
});
app.get("/login", function (req, res) {
    if (req.session.loginid !== -1) res.redirect("/");
    else res.render("login");
});
app.get("/register", function (req, res) {
    if (req.session.loginid !== -1) res.redirect("/");
    else res.render("register");
});
app.post("/login", function (req, res, next) {
    if (req.session.loginid !== -1) {
        debug.userapi("login only for anonymous users");
        res.redirect("/");
    } else if (typeof req.body.username !== typeof "string") {
        debug.userapi("username of incorrect type");
        res.redirect("/login?error=" + 0);
    } else if (typeof req.body.password !== typeof "string") {
        debug.userapi("password of incorrect type");
        res.redirect("/login?error=" + 1);
    } else {
        debug.userapi("login request as %s:%s", req.body.username, req.body.password);
        connection
            .select("id", "passwordsalt", "passwordhash", "isadministrator", "fullname", "username")
            .from("users")
            .where({
                "username": req.body.username
            }).then(function (users) {
                if (users.length < 1) {
                    debug.userapi("user %s not found", req.body.username);
                    res.redirect("/login?error=" + 3);
                    return;
                }
                if (sha512(req.body.password + users[0].passwordsalt).toString("hex") === users[0].passwordhash) {
                    debug.userapi("logged in as %s with password %s", req.body.username, req.body.password);
                    req.session.loginid = users[0].id;
                    req.session.loginadmin = users[0].isadministrator;
                    req.session.loginfullname = users[0].fullname;
                    req.session.loginusername = users[0].username;
                    res.redirect("/");
                } else {
                    debug.userapi("incorrect password for %s: %s (%s, expected %s)", req.body.username, req.body.password, sha512(req.body.password + users[0].passwordsalt).toString("hex"), users[0].passwordhash);
                    res.redirect("/login?error=" + 4);
                }
            });
    }
});
app.post("/register", function (req, res, next) {
    if (req.session.loginid !== -1) {
        debug.userapi("registration only for anonymous users");
        res.redirect("/");
    } else if (typeof req.body.username !== typeof "string") {
        debug.userapi("username of incorrect type");
        res.redirect("/register?error=" + 0);
    } else if (typeof req.body.name !== typeof "string") {
        debug.userapi("full name of incorrect type");
        res.redirect("/register?error=" + 2);
    } else if (typeof req.body.password !== typeof "string") {
        debug.userapi("password of incorrect type");
        res.redirect("/register?error=" + 1);
    } else {
        debug.userapi("registration request for %s:%s", req.body.username, req.body.password);
        connection
            .select("id")
            .from("users")
            .where({
                "username": req.body.username
            })
            .then(function (users) {
                if (users.length > 0) {
                    debug.userapi("user %s already exists", req.body.username);
                    res.redirect("/register?error=" + 5);
                    return;
                }
                var salt = Math.floor(Math.random() * 100000);
                debug.userapi("generated salt %s for %s", salt, req.body.username);
                var apikey = sha512(Math.floor(Math.random() * 1000000).toString()).toString("hex");
                debug.userapi("generated apikey %s for %s", apikey, req.body.username);
                var hash = sha512(req.body.password + salt).toString("hex");
                connection("users")
                    .returning("id")
                    .insert({
                        "username": req.body.username,
                        "fullname": req.body.name,
                        "passwordhash": hash,
                        "passwordsalt": salt,
                        "apikey": apikey
                    })
                    .then(function (results) {
                        debug.userapi("created user %s", req.body.username);
                        req.session.loginid = results[0];
                        req.session.loginadmin = false;
                        req.session.loginfullname = req.body.name;
                        req.session.loginusername = req.body.username;
                        res.redirect("/");
                    });
            });
    }
});
app.post("/checkusername", function (req, res) {
    connection
        .select("id")
        .from("users")
        .where({
            "username": req.body.username
        })
        .then(function (resu) {
            if (resu.length !== 1) {
                res.send("Username available");
            } else {
                res.send("Username taken");
            }
        });
});
app.get("/createissue", function (req, res, next) {
    if (req.session.loginid === -1) res.redirect("/");
    else {
        connection
            .select("id", "projectname")
            .from("projects")
            .then(function (results) {
                res.render("createissue", {
                    projects: results
                });
            });
    };
});
app.post("/createissue", function (req, res, next) {
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
        connection("issues")
            .insert({
                "issuename": req.body.name,
                "projectid": Number(req.body.projectid),
                "authorid": req.user.id
            })
            .returning("id")
            .then(function (ids) {
                debug.issueapi("successfully created issue");
                connection("issueposts")
                    .insert({
                        "issueid": ids[0],
                        "authorid": req.session.loginid,
                        "containedtext": req.body.firsttext,
                        "dateofcreation": new Date()
                    })
                    .then(function () {
                        debug.issueapi("successfully created first post");
                        res.redirect("/issue/" + ids[0]);
                    });
            });
    }
});
app.get("/issue/:issue", function (req, res, next) {
    if (typeof req.params.issue !== typeof "") {
        debug.issueapi("issue id of incorrect type");
        res.redirect("/");
    } else if (isNaN(Number(req.params.issue))) {
        debug.issueapi("issue id is not identifier");
        res.redirect("/");
    } else {
        debug.issueapi("issue request for issue %s", req.params.issue);
        connection
            .select("issues.id", "issues.issuename", "projects.shortprojectid", "issues.isclosed", "issues.assigneeid", "users.fullname")
            .from("issues")
            .leftJoin("projects", "issues.projectid", "projects.id")
            .leftJoin("users", "issues.assigneeid", "users.id")
            .where({
                "issues.id": Number(req.params.issue)
            })
            .then(function (issues) {
                if (issues.length < 1) {
                    debug.issueapi("issue %s not found", req.params.issue);
                    res.render("issuenotfound");
                } else {
                    debug.issueapi("successfully retrieved issue");
                    connection
                        .select("issueposts.containedtext", "issueposts.dateofcreation", "issueposts.dateofedit", "users.fullname", "issueposts.authorid", "issueposts.id")
                        .from("issueposts")
                        .leftJoin("users", "issueposts.authorid", "users.id")
                        .where({
                            "issueposts.issueid": issues[0].id
                        })
                        .orderBy("issueposts.id", "asc")
                        .then(function (posts) {
                            debug.issueapi("successfully retrieved issue posts");
                            connection
                                .select("tagtext", "id")
                                .from("issuetags")
                                .where({
                                    "issueid": req.params.issue
                                })
                                .then(function (tags) {
                                    debug.issueapi("successfully retrieved issue tags");
                                    connection
                                        .select("id", "fullname")
                                        .from("users")
                                        .then(function (users) {
                                            debug.issueapi("successfully retrieved users");
                                            res.render("issueview", {
                                                issue: issues[0],
                                                posts: posts,
                                                tags: tags,
                                                users: users
                                            });
                                        });
                                });
                        });
                };
            });
    }
});
app.post("/issue/:issue", function (req, res, next) {
    if (typeof req.params.issue !== typeof "") res.redirect("/");
    else if (isNaN(Number(req.params.issue))) res.redirect("/");
    else if (typeof req.body.text !== typeof "") res.status(400).end();
    else if (req.body.text === "") res.redirect("/");
    else {
        connection("issueposts")
            .insert({
                "containedtext": req.body.text,
                "authorid": req.session.loginid,
                "issueid": req.params.issue,
                "dateofcreation": new Date()
            })
            .returning("id")
            .then(function (ids) {
                res.redirect("/issue/" + req.params.issue + "#" + ids[0]);
            });
    }
});
app.get("/issue/:issue/open", function (req, res, next) {
    if (typeof req.params.issue !== typeof "") {
        debug.issueapi("issue id of incorrect type");
        res.redirect("/");
    } else if (isNaN(Number(req.params.issue))) {
        debug.issueapi("issue id is not identifier");
        res.redirect("/");
    } else {
        debug.issueapi("open request for issue %s", req.params.issue);
        connection
            .select("assigneeid")
            .from("issues")
            .where({
                "id": req.params.issue
            })
            .then(function (results) {
                if (req.user.id === results[0].AssigneeID || req.user.isadmin) {
                    debug.issueapi("opening issue %s", req.params.issue);
                    connection("issues")
                        .where({
                            "id": req.params.issue
                        })
                        .update({
                            "isclosed": false
                        })
                        .then(function (_) {
                            debug.issueapi("successfully opened issue %s", req.params.issue);
                            res.redirect("/issue/" + req.params.issue);
                        });
                } else {
                    res.status(403);
                    debug.issueapi("user is not privileged enough to open issue");
                }
            });
    }
});
app.get("/issue/:issue/close", function (req, res, next) {
    if (typeof req.params.issue !== typeof "") {
        debug.issueapi("issue id of incorrect type");
        res.redirect("/");
    } else if (isNaN(Number(req.params.issue))) {
        debug.issueapi("issue id is not identifier");
        res.redirect("/");
    } else {
        debug.issueapi("close request for issue %s", req.params.issue);
        connection
            .select("assigneeid")
            .from("issues")
            .where({
                "id": req.params.issue
            })
            .then(function (results) {
                if (req.user.id === results[0].AssigneeID || req.user.isadmin) {
                    debug.issueapi("closing issue %s", req.params.issue);
                    connection("issues")
                        .where({
                            "id": req.params.issue
                        })
                        .update({
                            "isclosed": true
                        })
                        .then(function () {
                            debug.issueapi("successfully closed issue %s", req.params.issue);
                            res.redirect("/issue/" + req.params.issue);
                        });
                } else {
                    debug.issueapi("user is not privileged enough to close issue");
                }
            });
    }
});
app.get("/issue/:issue/delete/areyousure", function (req, res) {
    res.render("areyousure");
});
app.get("/issue/:issue/delete", function (req, res, next) {
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
        connection("issueposts")
            .where({
                "issueid": req.params.issue
            })
            .del()
            .then(function () {
                debug.issueapi("deleted all posts in issue %s", req.params.issue);
                connection("issuetags")
                    .where({
                        "issueid": req.params.issue
                    })
                    .del()
                    .then(function () {
                        debug.issueapi("deleted all tags in issue %s", req.params.issue);
                        connection("issues")
                            .where({
                                "id": req.params.issue
                            })
                            .del()
                            .then(function () {
                                debug.issueapi("deleted issue %s", req.params.issue);
                                res.redirect("/issues");
                            });
                    });
            });
    }
});
app.get("/issue/:issue/addtag", function (req, res, next) {
    if (req.user.id === -1) {
        debug.issueapi("anonymous user trying to add tag");
        res.redirect("/");
    } else if (typeof req.params.issue !== typeof "") {
        debug.issueapi("issue id of incorrect type");
        res.redirect("/");
    } else if (isNaN(Number(req.params.issue))) {
        debug.issueapi("issue id is not identifier");
        res.redirect("/");
    } else if (typeof req.query.tagtext !== typeof "") {
        debug.issueapi("tag text of incorrect type");
        res.redirect("/");
    } else if (req.query.tagtext === "") {
        debug.issueapi("tag text empty");
        res.redirect("back");
    } else {
        debug.issueapi("addtag request for issue %s", req.params.issue);
        connection("issuetags")
            .insert({
                "tagtext": req.query.tagtext,
                "issueid": req.params.issue
            })
            .then(function () {
                debug.issueapi("added tag to issue %s", req.params.issue);
                res.redirect("/issue/" + req.params.issue);
            });
    }
});
app.get("/issue/:issue/assign", function (req, res, next) {
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
        connection("issues")
            .where({
                "id": req.params.issue
            })
            .update({
                "assigneeid": req.query.userid === "-1" ? null : req.query.userid
            })
            .then(function () {
                debug.issueapi("changed assignee for issue %s", req.params.issue);
                res.redirect("/issue/" + req.params.issue);
            });
    }
});
app.get("/issue/:issue/changetitle", function (req, res, next) {
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
        connection("issues")
            .where({
                "id": req.params.issue
            })
            .update({
                "issuename": req.query.newtitle
            })
            .then(function () {
                debug.issueapi("changed title for issue %s", req.params.issue);
                res.redirect("/issue/" + req.params.issue);
            });
    }
});
app.get("/createproject", function (req, res, next) {
    if (!req.user.isadmin) res.redirect("/");
    else res.render("createproject");
});
app.post("/createproject", function (req, res, next) {
    if (!req.user.isadmin) res.redirect("/");
    else if (typeof req.body.name !== typeof "string") res.status(400).end();
    else if (typeof req.body.shortprojectid !== typeof "string") res.status(400).end();
    else if (req.body.shortprojectid.length > 3 || req.body.shortprojectid === 0) res.status(400).end();
    else {
        connection("projects")
            .insert({
                "projectname": req.body.name,
                "authorid": req.session.loginid,
                "shortprojectid": req.body.shortprojectid
            })
            .then(function () {
                res.redirect("/");
            });
    }
});
app.get("/tag/:tag/remove", function (req, res, next) {
    if (req.user.id === -1) res.redirect("/");
    else if (typeof req.params.tag !== typeof "") res.redirect("/");
    else if (isNaN(Number(req.params.tag))) res.redirect("/");
    else {
        connection
            .select("issueid")
            .from("issuetags")
            .where({
                "id": req.params.tag
            })
            .then(function (tags) {
                if (tags.length < 1) {
                    res.redirect("/");
                } else
                    connection("issuetags")
                    .where({
                        "id": req.params.tag
                    })
                    .del()
                    .then(function () {
                        res.redirect("/issue/" + tags[0].issueid);
                    });
            });

    }
});
app.get("/post/:post/edit", function (req, res, next) {
    if (req.user.id === -1) res.redirect("/");
    else if (typeof req.params.post !== typeof "") res.redirect("/");
    else if (isNaN(Number(req.params.post))) res.redirect("/");
    else {
        connection
            .select("issueposts.id", "issueposts.containedtext", "issueposts.authorid", "issueposts.dateofcreation", "issueposts.dateofedit", "users.fullname")
            .from("issueposts")
            .leftJoin("users", "issueposts.authorid", "users.id")
            .where({
                "issueposts.id": req.params.post
            })
            .then(function (posts) {
                if (posts.length < 1) {
                    res.redirect("/");
                } else if (posts[0].authorid !== req.user.id) {
                    res.redirect("/");
                } else
                    res.render("editpost", {
                        post: posts[0]
                    });
            });
    }
});
app.post("/post/:post/edit", function (req, res, next) {
    if (req.user.id === -1) res.redirect("/");
    else if (typeof req.params.post !== typeof "") res.status(400).end();
    else if (isNaN(Number(req.params.post))) res.status(400).end();
    else if (typeof req.body.newtext !== typeof "") res.status(400).end();
    else if (req.body.newtext === "") res.redirect("back");
    else {
        connection
            .select("authorid", "issueid")
            .from("issueposts")
            .where({
                "id": req.params.post
            })
            .then(function (posts) {
                if (posts.length < 1) {
                    res.redirect("/");
                } else if (posts[0].authorid !== req.user.id) {
                    res.redirect("/");
                } else {
                    connection("issueposts")
                        .where({
                            "id": req.params.post
                        })
                        .update({
                            "containedtext": req.body.newtext,
                            "dateofedit": new Date()
                        })
                        .then(function () {
                            res.redirect("/issue/" + posts[0].issueid + "#" + req.params.post);
                        });
                }
            });
    }
});
app.get("/logout", function (req, res) {
    if (req.session.loginid !== -1)
        debug.userapi("logging out %s", req.user.username);
    req.session.loginid = -1;
    res.redirect("/");
});
app.listen(Number(process.env.PBUG_PORT || process.env.PORT || 8080));
debug.all("listening on " + Number(process.env.PBUG_PORT || process.env.PORT || 8080));