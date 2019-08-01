require("dotenv").config();
var debug = require("./debug");
var express = require("express");
var session = require("express-session");
var compression = require("compression");
var _ = require("lodash");
var uuid = require("uuid");
var errors = require("./errors");
var qs = require("qs");
var config = require("./config");
var { provePermission } = require("./permissions");
var { async } = require("./common");
var vroot = config["virtual-root"];
var marked = require("marked");
var mrenderer = new marked.Renderer();
mrenderer.link = function (href, title, text) {
    var link = href;
    if (href.startsWith("kb://"))
        link = vroot + "kb/" + href.substring(5);
    else if (href.startsWith("issue://"))
        link = vroot + "issues/" + href.substring(8);
    if (typeof title === typeof undefined)
        return `<a href="${link}">${text}</a>`;
    else
        return `<a href="${link}" title="${title}">${text}</a>`;
};
marked.setOptions({
    highlight: function (code) {
        return require("highlight.js").highlightAuto(code).value;
    },
    // sanitize: true,
    headerIds: false,
    gfm: true,
    renderer: mrenderer
});
var connection = require("./knexfile.js");
var fs = require("fs");
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
app.locals.provePermission = provePermission;
app.locals.mkdate = function (val) {
    if (val instanceof Date) return val;
    else return new Date(val);
};
app.use(async(async function (req, res, next) {
    req.id = uuid.v4();
    req.logger = debug.makeRequestLogger(req.id);
    req.logger.log("info", "(%s) %s %s - %s", req.connection.remoteAddress, req.method, req.path, req.headers["user-agent"]);
    if (typeof req.session.loginperms === typeof undefined) {
        req.session.loginrole = 1;
        req.session.loginperms = (await connection
            .select("permissions")
            .from("roles")
            .where({
                "id": 1
            }))[0].permissions;
        req.session.loginfullname = "Anonymous";
        req.session.loginusername = "anonymous";
    }
    if (typeof req.session.loginid === typeof undefined) req.session.loginid = -1;
    req.user = {};
    req.user.id = req.session.loginid;
    req.user.fullname = req.session.loginfullname;
    req.user.username = req.session.loginusername;
    req.user.role = req.session.loginrole;
    req.user.permissions = req.session.loginperms;
    res.locals.req = req;
    res.locals.config = config;
    res.locals.errors = errors;
    res.locals.qs = qs;
    req.vroot = config["virtual-root"];
    res.locals.vroot = req.vroot;
    next();
}));
app.use(express.urlencoded({
    extended: false
}));
app.use(vroot + "static/highlightstyles", express.static("node_modules/highlight.js/styles"));
app.get(vroot + "static/global.css", function (req, res, next) {
    fs.readFile("static/global.css", function (err, data) {
        if (err) next(err);
        res.set("Content-Type", "text/css");
        res.send(_.template(data)({ vroot: vroot }));
        res.end();
    });
});
app.use(vroot + "static", express.static("static"));
app.set("view engine", "pug");
app.set("trust proxy", 1);
app.get(vroot + "logo", function (req, res, next) {
    res.sendFile(config.design.logo, { root: process.cwd() });
});


app.use(require("./home"));
require("./admin.js")(app, connection, debug, config);
app.use(require("./users/login"));
app.use(require("./users/register"));
app.use(require("./users/useinvite"));
app.use(require("./users/check"));
app.use(require("./kb/search"));
app.use(require("./kb/create"));
app.use(require("./kb/editpost"));
app.use(require("./kb/edit"));
app.use(require("./kb/view"));
app.use(require("./kb/viewtalk"));
app.use(require("./kb/createpost"));
app.use(require("./kb/delete"));
app.use(require("./issues/search"));
app.use(require("./issues/create"));
app.use(require("./issues/viewactivity"));
app.use(require("./issues/viewtalk"));
app.use(require("./issues/createpost"));
app.use(require("./issues/changestatus.js"));
app.use(require("./issues/delete.js"));
app.use(require("./issues/editpost.js"));
app.use(require("./issues/edit.js"));
require("./files.js")(app, connection, debug, config);

app.use(function (req, res) {
    res.status(404).render("errors/404");
});
app.use(function (err, req, res, next) {
    res.status(500).render("errors/500", { error: err });
});

module.exports = app;
