var sha512 = require("sha512");
var qs = require("qs");
module.exports = function (app, connection, debug, config) {
    app.get("/login", async function (req, res) {
        if (req.session.loginid !== -1) res.redirect("/");
        else res.render("login");
    });
    app.get("/register", async function (req, res) {
        if (req.session.loginid !== -1) res.redirect("/");
        else
            if (config.login.allowregistration)
                res.render("register");
            else
                res.redirect("/useinvite?" + qs.stringify(req.query));
    });
    app.get("/useinvite", async function (req, res) {
        if (req.session.loginid !== -1) res.redirect("/");
        else
            if (config.login.allowregistration)
                res.redirect("/register?" + qs.stringify(req.query));
            else
                res.render("useinvite");
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
            debug.userapi("login request as %s", req.body.username);
            var users = await connection
                .select("users.*")
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
                debug.userapi("logged in as %s", req.body.username);
                req.session.loginid = users[0].id;
                req.session.loginadmin = users[0].isadministrator;
                req.session.loginfullname = users[0].fullname;
                req.session.loginusername = users[0].username;
                req.session.loginrole = users[0].roleid;
                res.redirect(redirect);
            } else {
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
            debug.userapi("registration request for %s", req.body.username);
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
            debug.userapi("generated salt for %s", req.body.username);
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
            req.session.loginrole = null;
            res.redirect(redirect);
        }
    });
    app.post("/useinvite", async function (req, res) {
        if (req.session.loginid !== -1) {
            debug.userapi("registration only for anonymous users");
            res.redirect("/");
        } else if (typeof req.body.inviteid !== typeof "string") {
            debug.userapi("inviteid is of incorrect type");
            res.redirect("/useinvite?" + qs.stringify(Object.assign(req.query, { error: 7 })));
        } else if (req.body.inviteid === "") {
            debug.userapi("inviteid empty");
            res.redirect("/useinvite?" + qs.stringify(Object.assign(req.query, { error: 7 })));
        } else if (typeof req.body.password !== typeof "string") {
            debug.userapi("password is of incorrect type");
            res.redirect("/useinvite?" + qs.stringify(Object.assign(req.query, { error: 1 })));

        } else if (req.body.password === "") {
            debug.userapi("password empty");
            res.redirect("/useinvite?" + qs.stringify(Object.assign(req.query, { error: 1 })));
        }
        else {
            var redirect = typeof req.query.redirect == "undefined" ? "/" : req.query.redirect;
            debug.userapi("registration request for %s", req.body.username);
            var invites = await connection
                .select()
                .from("invites")
                .where("uid", req.body.inviteid);
            if (invites.length < 0) {
                debug.userapi("invite %s already exists", req.body.inviteid);
                res.redirect("/useinvite?" + qs.stringify(Object.assign(req.query, { error: 6 })));
                return;
            }
            var salt = Math.floor(Math.random() * 100000);
            debug.userapi("generated salt for %s", invites[0].username);
            var apikey = sha512(Math.floor(Math.random() * 1000000).toString()).toString("hex");
            debug.userapi("generated apikey %s for %s", apikey, invites[0].username);
            var hash = sha512(req.body.password + salt).toString("hex");
            var userid = (await connection("users")
                .returning("id")
                .insert({
                    "username": invites[0].username,
                    "fullname": invites[0].fullname,
                    "passwordhash": hash,
                    "passwordsalt": salt,
                    "apikey": apikey
                }))[0];
            debug.userapi("created user %s", invites[0].username);
            await connection("invites")
                .where("uid", req.body.inviteid)
                .del();
            debug.userapi("removed invite %s", req.body.inviteid);
            req.session.loginid = userid;
            req.session.loginadmin = false;
            req.session.loginfullname = invites[0].fullname;
            req.session.loginusername = invites[0].username;
            req.session.loginrole = null;
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
    app.post("/checkinvite", async function (req, res) {
        var resu = await connection
            .select("id")
            .from("invites")
            .where({
                "uid": req.body.inviteid
            })
        if (resu.length !== 1) {
            res.send("Invite exists");
        } else {
            res.send("Invite doesn't exist");
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