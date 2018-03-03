var express = require("express");
var mysql = require("mysql");
var session = require("express-session");
var sha512 = require("sha512");
var markdown = require("markdown").markdown;
var connection = new mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB
});
var MySQLStore = require("express-mysql-session")(session);
var app = express();
var store = new MySQLStore({}, connection);
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
    if (typeof req.session.loginid === typeof undefined) req.session.loginid = -1;
    if (req.session.loginid === -1) req.session.loginadmin = false;
    req.user = {};
    req.user.id = req.session.loginid;
    req.user.isadmin = req.session.loginadmin;
    res.locals.req = req;
    next();
});
app.use(express.urlencoded({ extended: false }));
app.use("/static", express.static("static"));
app.set("view engine", "pug");
app.get("/", function (req, res, next) {
    if (req.user.id === -1)
        connection.query("SELECT Issues.ID, Issues.IssueName, Issues.IsClosed, Projects.ShortProjectID FROM Issues LEFT JOIN Projects ON Issues.ProjectID = Projects.ID WHERE Issues.IsClosed = FALSE ORDER BY ID DESC", function (err, results) {
            if (err) { next(err); return; }
            res.render("listissues", { issues: results, title: "List of open issues" });
        });
    else
        connection.query("SELECT Issues.ID, Issues.IssueName, Issues.IsClosed, Projects.ShortProjectID FROM Issues LEFT JOIN Projects ON Issues.ProjectID = Projects.ID WHERE Issues.IsClosed = FALSE AND AssigneeID=? ORDER BY ID DESC", [req.user.id], function (err, results) {
            if (err) { next(err); return; }
            res.render("listissues", { issues: results, title: "List of open issues assigned to you" });
        });
});
app.get("/issues", function (req, res) {
    res.redirect("/issues/open");
});
app.get("/issues/open", function (req, res, next) {
    connection.query("SELECT Issues.ID, Issues.IssueName, Issues.IsClosed, Projects.ShortProjectID FROM Issues LEFT JOIN Projects ON Issues.ProjectID = Projects.ID WHERE Issues.IsClosed = FALSE ORDER BY ID DESC", function (err, results) {
        if (err) { next(err); return; }
        res.render("listissuesopen", { issues: results });
    });
});
app.get("/issues/all", function (req, res, next) {
    connection.query("SELECT Issues.ID, Issues.IssueName, Issues.IsClosed, Projects.ShortProjectID FROM Issues LEFT JOIN Projects ON Issues.ProjectID = Projects.ID ORDER BY ID DESC", function (err, results) {
        if (err) { next(err); return; }
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
    if (req.session.loginid !== -1) res.redirect("/");
    else if (typeof req.body.username !== typeof "string") res.status(400).end();
    else if (typeof req.body.password !== typeof "string") res.status(400).end();
    else {
        connection.query("SELECT ID,PasswordSalt,PasswordHash,IsAdministrator FROM Users WHERE Username=?", [req.body.username], function (err, users) {
            if (err) { next(err); return; }
            if (users.length < 1) { res.status(403); return; }
            if (sha512(req.body.password + users[0].PasswordSalt).toString("hex") === users[0].PasswordHash) {
                req.session.loginid = users[0].ID;
                req.session.loginadmin = users[0].IsAdministrator;
                res.redirect("/");
            }
            else {
                res.status(403).end();
            }
        });
    }
});
app.post("/register", function (req, res, next) {
    if (req.session.loginid !== -1) res.redirect("/");
    else if (typeof req.body.username !== typeof "string") res.status(400).end();
    else if (typeof req.body.name !== typeof "string") res.status(400).end();
    else if (typeof req.body.password !== typeof "string") res.status(400).end();
    else {
        connection.query("SELECT ID FROM Users WHERE Username=?", [req.body.username], function (err1, users) {
            if (err1) { next(err1); return; }
            if (users.length > 0) { res.status(403); return; }
            var salt = Math.floor(Math.random() * 100000);
            var hash = sha512(req.body.password + salt).toString("hex");
            connection.query("INSERT INTO Users (Username,FullName,PasswordHash,PasswordSalt) VALUES (?,?,?,?)", [req.body.username, req.body.name, hash, salt], function (err2, results) {
                if (err2) { next(err2); return; }
                req.session.loginid = results.insertId;
                req.session.loginadmin = false;
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
    if (req.session.loginid === -1) res.redirect("/");
    else if (typeof req.body.name !== typeof "string") res.status(400).end();
    else if (req.body.name === "") res.redirect("/");
    else if (typeof req.body.firsttext !== typeof "string") res.status(400).end();
    else if (req.body.firsttext === "") res.redirect("/");
    else if (typeof req.body.projectid !== typeof "string") res.status(400).end();
    else if (isNaN(Number(req.body.projectid))) res.status(400).end();
    else
        connection.query("INSERT INTO Issues (IssueName,ProjectID) VALUES (?,?)", [req.body.name, Number(req.body.projectid)], function (err1, results) {
            if (err1) { next(err1); return; }
            connection.query("INSERT INTO IssuePosts (IssueID,AuthorID,ContainedText,DateOfCreation) VALUES (?,?,?,?)", [results.insertId, req.session.loginid, req.body.firsttext, new Date()], function (err2, results2) {
                if (err2) { next(err2); return; }
                res.redirect("/issue/" + results.insertId);
            });
        });
});
app.get("/issue/:issue", function (req, res, next) {
    if (typeof req.params.issue !== typeof "") res.redirect("/");
    else if (isNaN(Number(req.params.issue))) res.redirect("/");
    else {
        connection.query("SELECT Issues.ID,Issues.IssueName,Projects.ShortProjectID,Issues.IsClosed,Issues.AssigneeID,Users.FullName FROM Issues LEFT JOIN Projects ON Issues.ProjectID = Projects.ID LEFT JOIN Users ON Issues.AssigneeID = Users.ID WHERE Issues.ID=?", [Number(req.params.issue)], function (err1, issues) {
            if (err1) { next(err1); return; }
            if (issues.length < 1) res.render("issuenotfound");
            else {
                connection.query("SELECT IssuePosts.ContainedText,IssuePosts.DateOfCreation,IssuePosts.DateOfEdit,Users.FullName,IssuePosts.AuthorID,IssuePosts.ID FROM IssuePosts LEFT JOIN Users ON IssuePosts.AuthorID=Users.ID WHERE IssuePosts.IssueID=?", [issues[0].ID], function (err2, posts) {
                    if (err2) { next(err2); return; }
                    connection.query("SELECT TagText,ID FROM IssueTags WHERE IssueID=?", [req.params.issue], function (err3, tags) {
                        if (err3) { next(err3); return; }
                        connection.query("SELECT ID,FullName FROM Users", function (err4, users) {
                            if (err4) { next(err4); return; }
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
    if (typeof req.params.issue !== typeof "") res.redirect("/");
    else if (isNaN(Number(req.params.issue))) res.redirect("/");
    else {
        connection.query("SELECT AssigneeID FROM Issues WHERE ID=?", [req.params.issue], function (err, results) {
            if (err) {
                next(err); return;
            }
            if (req.user.id === results[0].AssigneeID || req.user.isadmin) {
                connection.query("UPDATE Issues SET Issues.IsClosed = FALSE WHERE ID = ?", [req.params.issue], function (err, results) {
                    if (err) { next(err); return; }
                    res.redirect("/issue/" + req.params.issue);
                });
            }
        });
    }
});
app.get("/issue/:issue/close", function (req, res, next) {
    if (typeof req.params.issue !== typeof "") res.redirect("/");
    else if (isNaN(Number(req.params.issue))) res.redirect("/");
    else {
        connection.query("SELECT AssigneeID FROM Issues WHERE ID=?", [req.params.issue], function (err, results) {
            if (err) {
                next(err); return;
            }
            if (req.user.id === results[0].AssigneeID || req.user.isadmin) {
                connection.query("UPDATE Issues SET Issues.IsClosed = TRUE WHERE ID = ?", [req.params.issue], function (err, results) {
                    if (err) { next(err); return; }
                    res.redirect("/issue/" + req.params.issue);
                });
            }
        });
    }
});
app.get("/issue/:issue/delete/areyousure", function (req, res) {
    res.render("areyousure");
});
app.get("/issue/:issue/delete", function (req, res, next) {
    if (!req.user.isadmin) res.redirect("/");
    else if (typeof req.params.issue !== typeof "") res.redirect("/");
    else if (isNaN(Number(req.params.issue))) res.redirect("/");
    else {
        connection.query("DELETE FROM IssuePosts WHERE IssueID=?", [req.params.issue], function (err1) {
            if (err1) { next(err1); return; }
            connection.query("DELETE FROM IssueTags WHERE IssueID=?", [req.params.issue], function (err2) {
                if (err2) { next(err2); return; }
                connection.query("DELETE FROM Issues WHERE ID=?", [req.params.issue], function (err3) {
                    if (err3) { next(err3); return; }
                    res.redirect("/issues");
                });
            });
        });
    }
});
app.get("/issue/:issue/addtag", function (req, res, next) {
    if (req.user.id === -1) res.redirect("/");
    else if (typeof req.params.issue !== typeof "") res.redirect("/");
    else if (isNaN(Number(req.params.issue))) res.redirect("/");
    else if (typeof req.query.tagtext !== typeof "") res.redirect("/");
    else if (req.body.tagtext === "") res.redirect("/");
    else {
        connection.query("INSERT INTO IssueTags (TagText,IssueID) VALUES (?,?)", [req.query.tagtext, req.params.issue], function (err, results) {
            if (err) { next(err); return; }
            res.redirect("/issue/" + req.params.issue);
        });
    }
});
app.get("/issue/:issue/assign", function (req, res, next) {
    if (req.user.id === -1) res.redirect("/");
    else if (typeof req.params.issue !== typeof "") res.redirect("/");
    else if (isNaN(Number(req.params.issue))) res.redirect("/");
    else if (typeof req.query.userid !== typeof "") res.redirect("/");
    else if (isNaN(Number(req.query.userid))) res.redirect("/");
    else {
        connection.query("UPDATE Issues SET AssigneeID=? WHERE ID=?", [req.query.userid === "-1" ? null : req.query.userid, req.params.issue], function (err, results) {
            if (err) { next(err); return; }
            res.redirect("/issue/" + req.params.issue);
        });
    }
});
app.get("/issue/:issue/changetitle", function (req, res, next) {
    if (req.user.id === -1) res.redirect("/");
    else if (typeof req.params.issue !== typeof "") res.redirect("/");
    else if (isNaN(Number(req.params.issue))) res.redirect("/");
    else if (typeof req.query.newtitle !== typeof "") res.redirect("/");
    else if (req.query.newtitle === "") res.redirect("/");
    else {
        connection.query("UPDATE Issues SET IssueName=? WHERE ID=?", [req.query.newtitle, req.params.issue], function (err, results) {
            if (err) { next(err); return; }
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
    else if (req.body.newtext === "") res.redirect("/");
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
    req.session.loginid = -1;
    res.redirect("/");
});
app.listen(8080);