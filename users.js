var sha512 = require("sha512");
var qs = require("qs");
module.exports = function (app, connection, debug, config) {
    app.get("/login", async function (req, res) {
        if (req.session.loginid !== -1) res.redirect("/");
        else res.render("login");
    });
    app.get("/register", async function (req, res) {
        if (req.session.loginid !== -1) res.redirect("/");
        else if (!config.login.allowregistration) res.redirect("/");
        else res.render("register");
    });
    app.post("/login", async function (req, res, next) {
        if (req.session.loginid !== -1) {
            debug.userapi("login only for anonymous users");
            res.redirect("/");
        } else if (typeof req.body.username !== typeof "string") {
            debug.userapi("username of incorrect type");
            res.redirect("/login?" + qs.stringify(Object.assign(req.query, { error: 0 })));
        } else if (typeof req.body.password !== typeof "string") {
            debug.userapi("password of incorrect type");
            res.redirect("/login?" + qs.stringify(Object.assign(req.query, { error: 1 })));
        } else {
            var redirect = typeof req.query.redirect === "undefined" ? "/" : req.query.redirect;
            debug.userapi("login request as %s:%s", req.body.username, req.body.password);
            var users = await connection
                .select("id", "passwordsalt", "passwordhash", "isadministrator", "fullname", "username")
                .from("users")
                .where({
                    "username": req.body.username
                });
            if (users.length < 1) {
                debug.userapi("user %s not found", req.body.username);
                res.redirect("/login?" + qs.stringify(Object.assign(req.query, { error: 3 })));
                return;
            }
            if (sha512(req.body.password + users[0].passwordsalt).toString("hex") === users[0].passwordhash) {
                debug.userapi("logged in as %s with password %s", req.body.username, req.body.password);
                req.session.loginid = users[0].id;
                req.session.loginadmin = users[0].isadministrator;
                req.session.loginfullname = users[0].fullname;
                req.session.loginusername = users[0].username;
                res.redirect(redirect);
            } else {
                debug.userapi("incorrect password for %s: %s (%s, expected %s)", req.body.username, req.body.password, sha512(req.body.password + users[0].passwordsalt).toString("hex"), users[0].passwordhash);
                res.redirect("/login?" + qs.stringify(Object.assign(req.query, { error: 4 })));
            }
        }
    });
    app.post("/register", async function (req, res, next) {
        if (req.session.loginid !== -1) {
            debug.userapi("registration only for anonymous users");
            res.redirect("/");
        } else if (!config.login.allowregistration) {
            debug.userapi("registration disallowed")
            res.redirect("/");
        } else if (typeof req.body.username !== typeof "string") {
            debug.userapi("username of incorrect type");
            res.redirect("/register?" + qs.stringify(Object.assign(req.query, { error: 0 })));
        } else if (typeof req.body.name !== typeof "string") {
            debug.userapi("full name of incorrect type");
            res.redirect("/register?" + qs.stringify(Object.assign(req.query, { error: 2 })));
        } else if (typeof req.body.password !== typeof "string") {
            debug.userapi("password of incorrect type");
            res.redirect("/register?" + qs.stringify(Object.assign(req.query, { error: 1 })));
        } else {
            var redirect = typeof req.query.redirect == "undefined" ? "/" : req.query.redirect;
            debug.userapi("registration request for %s:%s", req.body.username, req.body.password);
            var users = await connection
                .select("id")
                .from("users")
                .where({
                    "username": req.body.username
                })
            if (users.length > 0) {
                debug.userapi("user %s already exists", req.body.username);
                res.redirect("/register?" + qs.stringify(Object.assign(req.query, { error: 5 })));
                return;
            }
            var salt = Math.floor(Math.random() * 100000);
            debug.userapi("generated salt %s for %s", salt, req.body.username);
            var apikey = sha512(Math.floor(Math.random() * 1000000).toString()).toString("hex");
            debug.userapi("generated apikey %s for %s", apikey, req.body.username);
            var hash = sha512(req.body.password + salt).toString("hex");
            var userid = (await connection("users")
                .returning("id")
                .insert({
                    "username": req.body.username,
                    "fullname": req.body.name,
                    "passwordhash": hash,
                    "passwordsalt": salt,
                    "apikey": apikey
                }))[0];
            debug.userapi("created user %s", req.body.username);
            req.session.loginid = userid;
            req.session.loginadmin = false;
            req.session.loginfullname = req.body.name;
            req.session.loginusername = req.body.username;
            res.redirect(redirect);
        }
    });
    app.post("/checkusername", async function (req, res) {
        var resu = await connection
            .select("id")
            .from("users")
            .where({
                "username": req.body.username
            })
        if (resu.length !== 1) {
            res.send("Username available");
        } else {
            res.send("Username taken");
        }
    });
    app.get("/logout", async function (req, res) {
        if (req.session.loginid !== -1)
            debug.userapi("logging out %s", req.user.username);
        var redirect = typeof req.query.redirect == "undefined" ? "/" : req.query.redirect;
        req.session.loginid = -1;
        res.redirect(redirect);
    });
};