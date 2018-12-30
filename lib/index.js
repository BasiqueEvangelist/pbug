require("dotenv").config();
var express = require("express");
var session = require("express-session");
var compression = require("compression");
var errors = require("./errors");
var debug = {};
var qs = require("qs");
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
var connection = require("./knexfile.js");
var config = require("./config")();
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
    req.user.role = req.session.loginrole;
    res.locals.req = req;
    res.locals.config = config;
    res.locals.errors = errors;
    res.locals.qs = qs;
    next();
});
app.use(express.urlencoded({
    extended: false
}));
app.use("/static/highlightstyles", express.static("node_modules/highlight.js/styles"));
app.use("/static", express.static("static"));
app.set("view engine", "pug");
app.get("/logo", function (req, res, next) {
    res.sendFile(config.design.logo, { root: process.cwd() });
})
app.get("/", async function (req, res, next) {
    if (req.user.id === -1) {
        debug.issueapi("showing all open issues");
        var results = await connection
            .select({
                "id": "issues.id",
                "issuename": "issues.issuename",
                "isclosed": "issues.isclosed",
                "shortprojectid": "projects.shortprojectid",
                "assigneename": "users.fullname"
            })
            .from("issues")
            .leftJoin("projects", "issues.projectid", "projects.id")
            .leftJoin("users", "issues.assigneeid", "users.id")
            .where({
                "issues.isclosed": false
            })
            .orderBy("issues.id", "desc")
        debug.issueapi("issues retrieved, sending body");
        res.render("issues/listall", {
            issues: results,
            title: "List of open issues"
        });
    } else {
        debug.issueapi("showing all open issues assigned to %s", req.user.username);
        var results = await connection
            .select({
                "id": "issues.id",
                "issuename": "issues.issuename",
                "isclosed": "issues.isclosed",
                "shortprojectid": "projects.shortprojectid",
                "assigneename": "users.fullname"
            })
            .from("issues")
            .leftJoin("projects", "issues.projectid", "projects.id")
            .leftJoin("users", "issues.assigneeid", "users.id")
            .where({
                "issues.isclosed": false,
                "issues.assigneeid": req.user.id
            })
            .orderBy("issues.id", "desc")
            .limit(50);
        debug.issueapi("retrieving issues authored by user");
        var aresults = await connection
            .select({
                "id": "issues.id",
                "issuename": "issues.issuename",
                "isclosed": "issues.isclosed",
                "shortprojectid": "projects.shortprojectid",
                "assigneename": "users.fullname"
            })
            .from("issues")
            .leftJoin("projects", "issues.projectid", "projects.id")
            .leftJoin("users", "issues.assigneeid", "users.id")
            .where({
                "issues.isclosed": false,
                "issues.authorid": req.user.id
            })
            .orderBy("issues.id", "desc")
            .limit(50);
        debug.issueapi("issues retrieved, sending body");
        res.render("issues/listall", {
            issues: results,
            aissues: aresults,
            title: "List of open issues assigned to you"
        });
    }
});

app.get("/files/get/:uid", async function (req, res, next) {
    var files = await connection
        .select("filename")
        .from("files")
        .where("uid", req.params.uid);
    if (files.length < 1)
        res.redirect("/");
    res.setHeader("content-disposition", "attachment; filename=" + encodeURIComponent(files[0].filename));
    res.sendFile("./files/" + req.params.uid, { root: process.cwd() });
    res.end();
});

require("./admin.js")(app, connection, debug, config);
require("./users.js")(app, connection, debug, config);
require("./kb.js")(app, connection, debug, config);
require("./issues.js")(app, connection, debug, config);

app.use(function (req, res) {
    res.status(404).render("errors/404");
});
setInterval(require("./gc.js"), 5 * 1000);
app.listen(Number(process.env.PBUG_PORT || process.env.PORT || 8080));
debug.all("listening on " + Number(process.env.PBUG_PORT || process.env.PORT || 8080));