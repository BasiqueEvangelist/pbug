var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var sha512 = require("crypto-js/sha512");
var qs = require("qs");

router.get(vroot + "register", async function (req, res) {
    if (req.session.loginid !== -1) res.redirect(vroot);
    else
        if (config.login.allowregistration == "open")
            res.render("register");
        else if (config.login.allowregistration == "inviteonly")
            res.redirect(vroot + "useinvite?" + qs.stringify(req.query));
        else
            res.render("regclosed");

});
router.post(vroot + "register", async function (req, res, next) {
    if (req.session.loginid !== -1) {
        debug.userapi("registration only for anonymous users");
        res.redirect(vroot);
    } else if (config.login.allowregistration !== "open") {
        debug.userapi("registration disallowed")
        res.redirect(vroot);
    } else if (typeof req.body.username !== typeof "string") {
        debug.userapi("username of incorrect type");
        res.redirect(vroot + "register?" + qs.stringify(Object.assign(req.query, { error: 0 })));
    } else if (typeof req.body.name !== typeof "string") {
        debug.userapi("full name of incorrect type");
        res.redirect(vroot + "register?" + qs.stringify(Object.assign(req.query, { error: 2 })));
    } else if (typeof req.body.password !== typeof "string") {
        debug.userapi("password of incorrect type");
        res.redirect(vroot + "register?" + qs.stringify(Object.assign(req.query, { error: 1 })));
    } else {
        var redirect = typeof req.query.redirect == "undefined" ? vroot : req.query.redirect;
        debug.userapi("registration request for %s", req.body.username);
        var users = await connection
            .select("id")
            .from("users")
            .where({
                "username": req.body.username
            })
        if (users.length > 0) {
            debug.userapi("user %s already exists", req.body.username);
            res.redirect(vroot + "register?" + qs.stringify(Object.assign(req.query, { error: 5 })));
            return;
        }
        var salt = Math.floor(Math.random() * 100000);
        debug.userapi("generated salt for %s", req.body.username);
        var apikey = sha512(Math.floor(Math.random() * 1000000).toString()).toString();
        debug.userapi("generated apikey %s for %s", apikey, req.body.username);
        var hash = sha512(req.body.password + salt).toString();
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

module.exports = router;
