var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var sha512 = require("crypto-js/sha512");
var qs = require("qs");
var { mksalt, hashpassword, checkredirect } = require("./common");

router.get(vroot + "register", async function (req, res) {
    if (req.session.loginid !== -1) res.redirect(vroot);
    else
        if (config.login.allowregistration === "open")
            res.render("register");
        else if (config.login.allowregistration === "inviteonly")
            res.redirect(vroot + "useinvite?" + qs.stringify(req.query));
        else
            res.render("regclosed");

});
router.post(vroot + "register", async function (req, res, next) {
    if (req.session.loginid !== -1) {
        req.logger.log("debug", "registration only for anonymous users");
        res.redirect(vroot);
    } else if (config.login.allowregistration !== "open") {
        req.logger.log("debug", "registration disallowed");
        res.redirect(vroot);
    } else if (typeof req.body.username !== typeof "string") {
        req.logger.log("debug", "username of incorrect type");
        res.redirect(vroot + "register?" + qs.stringify(Object.assign(req.query, { error: 0 })));
    } else if (typeof req.body.name !== typeof "string") {
        req.logger.log("debug", "full name of incorrect type");
        res.redirect(vroot + "register?" + qs.stringify(Object.assign(req.query, { error: 2 })));
    } else if (typeof req.body.password !== typeof "string") {
        req.logger.log("debug", "password of incorrect type");
        res.redirect(vroot + "register?" + qs.stringify(Object.assign(req.query, { error: 1 })));
    } else {
        var redirect = typeof req.query.redirect === "undefined" ? vroot : req.query.redirect;
        req.logger.log("debug", "registration request for %s", req.body.username);
        var users = await connection
            .select("id")
            .from("users")
            .where({
                "username": req.body.username
            });
        if (users.length > 0) {
            req.logger.log("debug", "user %s already exists", req.body.username);
            res.redirect(vroot + "register?" + qs.stringify(Object.assign(req.query, { error: 5 })));
            return;
        }
        var salt = await mksalt();
        req.logger.log("debug", "generated salt for %s", req.body.username);
        var apikey = sha512(Math.floor(Math.random() * 1000000).toString()).toString();
        req.logger.log("debug", "generated apikey %s for %s", apikey, req.body.username);
        var hash = await hashpassword(req.body.password, salt);
        var userid = (await connection("users")
            .returning("id")
            .insert({
                "username": req.body.username,
                "fullname": req.body.name,
                "passwordhash": hash,
                "passwordsalt": salt,
                "apikey": apikey
            }))[0];
        req.logger.log("debug", "created user %s", req.body.username);
        req.session.loginid = userid;
        req.session.loginadmin = false;
        req.session.loginfullname = req.body.name;
        req.session.loginusername = req.body.username;
        req.session.loginrole = null;
        if (checkredirect(redirect))
            res.redirect(redirect);
    }
});

module.exports = router;
