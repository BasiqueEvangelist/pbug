var express = require("express");
var mysql = require("mysql");
var session = require("express-session");
var sha512 = require("sha512");
var compression = require("compression");
var debug = {};
debug.all = require("debug")("pbug*");
debug.request = require("debug")("pbug:request");
debug.userapi = require("debug")("pbug:userapi");
debug.issueapi = require("debug")("pbug:issueapi");
var markdown = require("markdown").markdown;
debug.all("starting pbug");
require("dotenv").config();
var connection = require("./database.js")(
    process.env.DB_TYPE,
    process.env.DB_HOST,
    process.env.DB_USER,
    process.env.DB_PASS,
    process.env.DB_DB
);
var MySQLStore = require("express-mysql-session")(session);
var app = express();
// app.use(compression());
var store;
if (process.env.PBUG_USESTORE === "mysql")
    store = new MySQLStore({}, connection);
else if (process.env.PBUG_USESTORE === "memory")
    store = new session.MemoryStore();
app.use(session({
    name: "pbug.sid",
    secret: "pbugpbugpbugpbug",
    resave: true,
    saveUninitialized: false,
    store: store
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
    next();
});
app.use(express.urlencoded({ extended: false }));
app.use("/static", express.static("static"));
app.set("view engine", "pug");
app.get("/", function (req, res, next) {
    if (req.user.id === -1) {
        debug.issueapi("showing all open issues");
        connection.query("SELECT Issues.ID, Issues.IssueName, Issues.IsClosed, Projects.ShortProjectID FROM Issues LEFT JOIN Projects ON Issues.ProjectID = Projects.ID WHERE Issues.IsClosed = FALSE ORDER BY ID DESC", function (err, results) {
            if (err) { next(err); return; }
            debug.issueapi("issues retrieved, sending body");
            res.render("listissues", { issues: results, title: "List of open issues" });
        });
    }
    else {
        debug.issueapi("showing all open issues assigned to %s", req.user.username);
        connection.query("SELECT Issues.ID, Issues.IssueName, Issues.IsClosed, Projects.ShortProjectID FROM Issues LEFT JOIN Projects ON Issues.ProjectID = Projects.ID WHERE Issues.IsClosed = FALSE AND AssigneeID=? ORDER BY ID DESC", [req.user.id], function (err, results) {
            if (err) { next(err); return; }
            debug.issueapi("issues retrieved, sending body");
            res.render("listissues", { issues: results, title: "List of open issues assigned to you" });
        });
    }
});
app.get("/issues", function (req, res) {
    res.redirect("/issues/open");
});
app.get("/issues/open", function (req, res, next) {
    debug.issueapi("showing all open issues");
    connection.query("SELECT Issues.ID, Issues.IssueName, Issues.IsClosed, Projects.ShortProjectID FROM Issues LEFT JOIN Projects ON Issues.ProjectID = Projects.ID WHERE Issues.IsClosed = FALSE ORDER BY ID DESC", function (err, results) {
        if (err) { next(err); return; }
        debug.issueapi("issues retrieved, sending body");
        res.render("listissuesopen", { issues: results });
    });
});
app.get("/issues/all", function (req, res, next) {
    debug.issueapi("showing all issues");
    connection.query("SELECT Issues.ID, Issues.IssueName, Issues.IsClosed, Projects.ShortProjectID FROM Issues LEFT JOIN Projects ON Issues.ProjectID = Projects.ID ORDER BY ID DESC", function (err, results) {
        if (err) { next(err); return; }
        debug.issueapi("issues retrieved, sending body");
        res.render("listissuesall", { issues: results });
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
    }
    else if (typeof req.body.username !== typeof "string") {
        debug.userapi("username of incorrect type");
        res.status(400).end();
    }
    else if (typeof req.body.password !== typeof "string") {
        debug.userapi("password of incorrect type");
        res.status(400).end();
    }
    else {
        debug.userapi("login request as %s:%s", req.body.username, req.body.password);
        connection.query("SELECT ID,PasswordSalt,PasswordHash,IsAdministrator,FullName,Username FROM Users WHERE Username=?", [req.body.username], function (err, users) {
            if (err) { next(err); return; }
            if (users.length < 1) {
                debug.userapi("user %s not found", req.body.username);
                res.status(403);
                return;
            }
            if (sha512(req.body.password + users[0].PasswordSalt).toString("hex") === users[0].PasswordHash) {
                debug.userapi("logged in as %s with password %s", req.body.username, req.body.password);
                req.session.loginid = users[0].ID;
                req.session.loginadmin = users[0].IsAdministrator;
                req.session.loginfullname = users[0].FullName;
                req.session.loginusername = users[0].Username;
                res.redirect("/");
            }
            else {
                debug.userapi("incorrect password for %s: %s", req.body.username, req.body.password);
                res.status(403).end();
            }
        });
    }
});
app.post("/register", function (req, res, next) {
    if (req.session.loginid !== -1) {
        debug.userapi("registration only for anonymous users");
        res.redirect("/");
    }
    else if (typeof req.body.username !== typeof "string") {
        debug.userapi("username of incorrect type");
        res.status(400).end();
    }
    else if (typeof req.body.name !== typeof "string") {
        debug.userapi("full name of incorrect type");
        res.status(400).end();
    }
    else if (typeof req.body.password !== typeof "string") {
        debug.userapi("password of incorrect type");
        res.status(400).end();
    }
    else {
        debug.userapi("registration request for %s:%s", req.body.username, req.body.password);
        connection.query("SELECT ID FROM Users WHERE Username=?", [req.body.username], function (err1, users) {
            if (err1) { next(err1); return; }
            if (users.length > 0) {
                debug.userapi("user %s already exists", req.body.username);
                res.status(403);
                res.end();
                return;
            }
            var salt = Math.floor(Math.random() * 100000);
            debug.userapi("generated salt %s for %s", salt, req.body.username);
            var apikey = sha512(Math.floor(Math.random() * 1000000).toString()).toString("hex");
            debug.userapi("generated apikey %s for %s", apikey, req.body.username);
            var hash = sha512(req.body.password + salt).toString("hex");
            connection.query("INSERT INTO Users (Username,FullName,PasswordHash,PasswordSalt,APIKey) VALUES (?,?,?,?,?)", [req.body.username, req.body.name, hash, salt, apikey], function (err2, results) {
                if (err2) { next(err2); return; }
                debug.userapi("created user %s", req.body.username);
                req.session.loginid = results.insertId;
                req.session.loginadmin = false;
                req.session.loginfullname = req.body.name;
                req.session.loginusername = req.body.username;
                res.redirect("/");
            });
        });
    }
});
app.get("/createissue", function (req, res, next) {
    if (req.session.loginid === -1) res.redirect("/");
    else {
        connection.query("SELECT ID,ProjectName FROM Projects", function (err, results) {
            if (err) { next(err); return; }
            res.render("createissue", { projects: results });
        });
    };
});
app.post("/createissue", function (req, res, next) {
    if (req.session.loginid === -1) {
        debug.issueapi("unprivileged user tried to create issue");
        res.redirect("/");
    }
    else if (typeof req.body.name !== typeof "string") {
        debug.issueapi("issue name of incorrect type");
        res.status(400).end();
    }
    else if (req.body.name === "") {
        debug.issueapi("issue name empty");
        res.redirect("/");
    }
    else if (typeof req.body.firsttext !== typeof "string") {
        debug.issueapi("issue text (text of first post) of incorrect type");
        res.status(400).end();
    }
    else if (req.body.firsttext === "") {
        debug.issueapi("issue text (text of first post) empty");
        res.redirect("/");
    }
    else if (typeof req.body.projectid !== typeof "string") {
        debug.issueapi("issue project of incorrect type");
        res.status(400).end();
    }
    else if (isNaN(Number(req.body.projectid))) {
        debug.issueapi("issue project is not an identifier");
        res.status(400).end();
    }
    else {
        debug.issueapi("%s is creating issue", req.user.username);
        connection.query("INSERT INTO Issues (IssueName,ProjectID) VALUES (?,?)", [req.body.name, Number(req.body.projectid)], function (err1, results) {
            if (err1) { next(err1); return; }
            debug.issueapi("successfully created issue");
            connection.query("INSERT INTO IssuePosts (IssueID,AuthorID,ContainedText,DateOfCreation) VALUES (?,?,?,?)", [results.insertId, req.session.loginid, req.body.firsttext, new Date()], function (err2, results2) {
                if (err2) { next(err2); return; }
                debug.issueapi("successfully created first post");
                res.redirect("/issue/" + results.insertId);
            });
        });
    }
});
app.get("/issue/:issue", function (req, res, next) {
    if (typeof req.params.issue !== typeof "") {
        debug.issueapi("issue id of incorrect type");
        res.redirect("/");
    }
    else if (isNaN(Number(req.params.issue))) {
        debug.issueapi("issue id is not identifier");
        res.redirect("/");
    }
    else {
        debug.issueapi("issue request for issue %s", req.params.issue);
        connection.query("SELECT Issues.ID,Issues.IssueName,Projects.ShortProjectID,Issues.IsClosed,Issues.AssigneeID,Users.FullName FROM Issues LEFT JOIN Projects ON Issues.ProjectID = Projects.ID LEFT JOIN Users ON Issues.AssigneeID = Users.ID WHERE Issues.ID=?", [Number(req.params.issue)], function (err1, issues) {
            if (err1) { next(err1); return; }
            if (issues.length < 1) {
                debug.issueapi("issue %s not found", req.params.issue);
                res.render("issuenotfound");
            }
            else {
                debug.issueapi("successfully retrieved issue");
                connection.query("SELECT IssuePosts.ContainedText,IssuePosts.DateOfCreation,IssuePosts.DateOfEdit,Users.FullName,IssuePosts.AuthorID,IssuePosts.ID FROM IssuePosts LEFT JOIN Users ON IssuePosts.AuthorID=Users.ID WHERE IssuePosts.IssueID=?", [issues[0].ID], function (err2, posts) {
                    if (err2) { next(err2); return; }
                    debug.issueapi("successfully retrieved issue posts");
                    connection.query("SELECT TagText,ID FROM IssueTags WHERE IssueID=?", [req.params.issue], function (err3, tags) {
                        if (err3) { next(err3); return; }
                        debug.issueapi("successfully retrieved issue tags");
                        connection.query("SELECT ID,FullName FROM Users", function (err4, users) {
                            if (err4) { next(err4); return; }
                            debug.issueapi("successfully retrieved users");
                            res.render("issueview", { issue: issues[0], posts: posts, tags: tags, users: users });
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
        connection.query("INSERT INTO IssuePosts (ContainedText,AuthorID,IssueID,DateOfCreation) VALUES (?,?,?,?)", [req.body.text, req.session.loginid, req.params.issue, new Date()], function (err, results) {
            if (err) { next(err); return; }
            res.redirect("/issue/" + req.params.issue);
        });
    }
});
app.get("/issue/:issue/open", function (req, res, next) {
    if (typeof req.params.issue !== typeof "") {
        debug.issueapi("issue id of incorrect type");
        res.redirect("/");
    }
    else if (isNaN(Number(req.params.issue))) {
        debug.issueapi("issue id is not identifier");
        res.redirect("/");
    }
    else {
        debug.issueapi("open request for issue %s", req.params.issue);
        connection.query("SELECT AssigneeID FROM Issues WHERE ID=?", [req.params.issue], function (err, results) {
            if (err) {
                next(err); return;
            }
            if (req.user.id === results[0].AssigneeID || req.user.isadmin) {
                debug.issueapi("opening issue %s", req.params.issue);
                connection.query("UPDATE Issues SET Issues.IsClosed = FALSE WHERE ID = ?", [req.params.issue], function (err, results) {
                    if (err) { next(err); return; }
                    debug.issueapi("successfully opened issue %s", req.params.issue);
                    res.redirect("/issue/" + req.params.issue);
                });
            }
            else {
                debug.issueapi("user is not privileged enough to open issue");
            }
        });
    }
});
app.get("/issue/:issue/close", function (req, res, next) {
    if (typeof req.params.issue !== typeof "") {
        debug.issueapi("issue id of incorrect type");
        res.redirect("/");
    }
    else if (isNaN(Number(req.params.issue))) {
        debug.issueapi("issue id is not identifier");
        res.redirect("/");
    }
    else {
        debug.issueapi("close request for issue %s", req.params.issue);
        connection.query("SELECT AssigneeID FROM Issues WHERE ID=?", [req.params.issue], function (err, results) {
            if (err) {
                next(err); return;
            }
            if (req.user.id === results[0].AssigneeID || req.user.isadmin) {
                debug.issueapi("closing issue %s", req.params.issue);
                connection.query("UPDATE Issues SET Issues.IsClosed = TRUE WHERE ID = ?", [req.params.issue], function (err, results) {
                    if (err) { next(err); return; }
                    debug.issueapi("successfully closed issue %s", req.params.issue);
                    res.redirect("/issue/" + req.params.issue);
                });
            }
            else {
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
    }
    else if (typeof req.params.issue !== typeof "") {
        debug.issueapi("issue id of incorrect type");
        res.redirect("/");
    }
    else if (isNaN(Number(req.params.issue))) {
        debug.issueapi("issue id is not identifier");
        res.redirect("/");
    }
    else {
        connection.query("DELETE FROM IssuePosts WHERE IssueID=?", [req.params.issue], function (err1) {
            if (err1) { next(err1); return; }
            debug.issueapi("deleted all posts in issue %s", req.params.issue);
            connection.query("DELETE FROM IssueTags WHERE IssueID=?", [req.params.issue], function (err2) {
                if (err2) { next(err2); return; }
                debug.issueapi("deleted all tags in issue %s", req.params.issue);
                connection.query("DELETE FROM Issues WHERE ID=?", [req.params.issue], function (err3) {
                    if (err3) { next(err3); return; }
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
    }
    else if (typeof req.params.issue !== typeof "") {
        debug.issueapi("issue id of incorrect type");
        res.redirect("/");
    }
    else if (isNaN(Number(req.params.issue))) {
        debug.issueapi("issue id is not identifier");
        res.redirect("/");
    }
    else if (typeof req.query.tagtext !== typeof "") {
        debug.issueapi("tag text of incorrect type");
        res.redirect("/");
    }
    else if (req.query.tagtext === "") {
        debug.issueapi("tag text empty");
        res.redirect("back");
    }
    else {
        debug.issueapi("addtag request for issue %s", req.params.issue);
        connection.query("INSERT INTO IssueTags (TagText,IssueID) VALUES (?,?)", [req.query.tagtext, req.params.issue], function (err, results) {
            if (err) { next(err); return; }
            debug.issueapi("added tag to issue %s", req.params.issue);
            res.redirect("/issue/" + req.params.issue);
        });
    }
});
app.get("/issue/:issue/assign", function (req, res, next) {
    if (req.user.id === -1) {
        debug.issueapi("anonymous user trying to assign");
        res.redirect("/");
    }
    else if (typeof req.params.issue !== typeof "") {
        debug.issueapi("issue id of incorrect type");
        res.redirect("/");
    }
    else if (isNaN(Number(req.params.issue))) {
        debug.issueapi("issue id is not identifier");
        res.redirect("/");
    }
    else if (typeof req.query.userid !== typeof "") {
        debug.issueapi("chosen assignee id of incorrect type");
        res.redirect("/");
    }
    else if (isNaN(Number(req.query.userid))) {
        debug.issueapi("chosen assignee  id is not identifier");
        res.redirect("/");
    }
    else {
        debug.issueapi("assign request for issue %s", req.params.issue);
        connection.query("UPDATE Issues SET AssigneeID=? WHERE ID=?", [req.query.userid === "-1" ? null : req.query.userid, req.params.issue], function (err, results) {
            if (err) { next(err); return; }
            debug.issueapi("changed assignee for issue %s", req.params.issue);
            res.redirect("/issue/" + req.params.issue);
        });
    }
});
app.get("/issue/:issue/changetitle", function (req, res, next) {
    if (req.user.id === -1) {
        debug.issueapi("anonymous user trying to change title");
        res.redirect("/");
    }
    else if (typeof req.params.issue !== typeof "") {
        debug.issueapi("issue id of incorrect type");
        res.redirect("/");
    }
    else if (isNaN(Number(req.params.issue))) {
        debug.issueapi("issue id is not identifier");
        res.redirect("/");
    }
    else if (typeof req.query.newtitle !== typeof "") {
        debug.issueapi("new title of incorrect type");
        res.redirect("/");
    }
    else if (req.query.newtitle === "") {
        debug.issueapi("new title empty");
        res.redirect("back");
    }
    else {
        debug.issueapi("changetitle request for issue %s", req.params.issue);
        connection.query("UPDATE Issues SET IssueName=? WHERE ID=?", [req.query.newtitle, req.params.issue], function (err, results) {
            if (err) { next(err); return; }
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
        connection.query("INSERT INTO Projects (ProjectName,AuthorID,ShortProjectID) VALUES (?,?,?)", [req.body.name, req.session.loginid, req.body.shortprojectid], function (err, results) {
            if (err) { next(err); return; }
            res.redirect("/");
        });
    }
});
app.get("/tag/:tag/remove", function (req, res, next) {
    if (req.user.id === -1) res.redirect("/");
    else if (typeof req.params.tag !== typeof "") res.redirect("/");
    else if (isNaN(Number(req.params.tag))) res.redirect("/");
    else {
        connection.query("SELECT IssueID FROM IssueTags WHERE ID=?", [req.params.tag], function (err1, tags) {
            if (err1) { next(err1); return; }
            else if (tags.length < 1) { res.redirect("/"); }
            else
                connection.query("DELETE FROM IssueTags WHERE ID=?", [req.params.tag], function (err2, results) {
                    if (err2) { next(err2); return; }
                    res.redirect("/issue/" + tags[0].IssueID);
                });
        });
    }
});
app.get("/post/:post/edit", function (req, res, next) {
    if (req.user.id === -1) res.redirect("/");
    else if (typeof req.params.post !== typeof "") res.redirect("/");
    else if (isNaN(Number(req.params.post))) res.redirect("/");
    else {
        connection.query("SELECT IssuePosts.ID,IssuePosts.ContainedText,IssuePosts.AuthorID,IssuePosts.DateOfCreation,IssuePosts.DateOfEdit,Users.FullName FROM IssuePosts LEFT JOIN Users ON IssuePosts.AuthorID=Users.ID WHERE IssuePosts.ID=?", [req.params.post], function (err1, posts) {
            if (err1) { next(err1); return; }
            else if (posts.length < 1) { res.redirect("/"); }
            else if (posts[0].AuthorID !== req.user.id) { res.redirect("/"); }
            else
                res.render("editpost", { post: posts[0] });
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
        connection.query("SELECT AuthorID FROM IssuePosts WHERE ID=?", [req.params.post], function (err1, posts) {
            if (err1) { next(err1); return; }
            else if (posts.length < 1) { res.redirect("/"); }
            else if (posts[0].AuthorID !== req.user.id) { res.redirect("/"); }
            else {
                connection.query("UPDATE IssuePosts SET ContainedText=?,DateOfEdit=? WHERE ID=?", [req.body.newtext, new Date(), req.params.post], function (err2, results) {
                    if (err2) { next(err2); return; }
                    res.redirect("/");
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