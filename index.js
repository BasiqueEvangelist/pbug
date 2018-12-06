require("dotenv").config();
var express = require("express");
var session = require("express-session");
var sha512 = require("sha512");
var compression = require("compression");
var Knex = require("knex");
var diff = require("diff");
var errors = require("./errors");
var debug = {};
debug.all = require("debug")("pbug*");
debug.request = require("debug")("pbug:request");
debug.userapi = require("debug")("pbug:userapi");
debug.issueapi = require("debug")("pbug:issueapi");
var marked = require("marked");
marked.setOptions({
    highlight: function (code) {
        return require("highlight.js").highlightAuto(code).value;
    },
    // sanitize: true,
    headerIds: false,
    gfm: true
});
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
app.locals.parseMarkdown = marked;
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
app.use("/static/highlightstyles", express.static("node_modules/highlight.js/styles"));
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
                res.render("issues/listall", {
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
                        res.render("issues/listall", {
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
            res.render("issues/listgroup", {
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
            res.render("issues/listgroup", {
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
            res.render("issues/listgroup", {
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
            res.render("issues/listgroup", {
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
            .select("issueid", "tagtext")
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
                            connection("issueactivities")
                                .insert({
                                    "dateofoccurance": new Date(),
                                    "issueid": tags[0].issueid,
                                    "authorid": req.user.id,
                                    "data": {
                                        type: "deltag",
                                        text: tags[0].tagtext
                                    }
                                })
                                .then(function () {
                                    res.redirect("/issues/" + tags[0].issueid + "/posts");
                                });
                        });
            });
    }
});


require("./kb.js")(app, connection, debug);
require("./issues.js")(app, connection, debug);

app.get("/logout", function (req, res) {
    if (req.session.loginid !== -1)
        debug.userapi("logging out %s", req.user.username);
    req.session.loginid = -1;
    res.redirect("/");
});
app.use(function (req, res) {
    res.status(404).render("404");
});
app.listen(Number(process.env.PBUG_PORT || process.env.PORT || 8080));
debug.all("listening on " + Number(process.env.PBUG_PORT || process.env.PORT || 8080));