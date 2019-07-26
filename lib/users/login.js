var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var sha512 = require("crypto-js/sha512");
var qs = require("qs");
var { hashpassword, checkredirect } = require("./common");
var { async } = require("../common");

router.get(vroot + "login", async(async function (req, res) {
    if (req.session.loginid !== -1) res.redirect(vroot);
    else res.render("login");
}));
router.post(vroot + "login", async(async function (req, res, next) {
    if (req.session.loginid !== -1) {
        req.logger.log("debug", "login only for anonymous users");
        res.redirect(vroot);
    } else if (typeof req.body.username !== typeof "string") {
        req.logger.log("debug", "username of incorrect type");
        res.redirect(vroot + "login?" + qs.stringify(Object.assign(req.query, { error: 0 })));
    } else if (typeof req.body.password !== typeof "string") {
        req.logger.log("debug", "password of incorrect type");
        res.redirect(vroot + "login?" + qs.stringify(Object.assign(req.query, { error: 1 })));
    } else {
        var redirect = typeof req.query.redirect === "undefined" ? vroot : req.query.redirect;
        req.logger.log("debug", "login request as %s", req.body.username);
        var users = await connection
            .select("users.*", "roles.permissions")
            .from("users")
            .leftJoin("roles", "users.roleid", "roles.id")
            .where({
                "username": req.body.username
            });
        if (users.length < 1) {
            req.logger.log("debug", "user %s not found", req.body.username);
            res.redirect(vroot + "login?" + qs.stringify(Object.assign(req.query, { error: 3 })));
            return;
        }
        if (await hashpassword(req.body.password, users[0].passwordsalt) === users[0].passwordhash) {
            req.logger.log("debug", "logged in as %s", req.body.username);
            req.session.loginid = users[0].id;
            req.session.loginfullname = users[0].fullname;
            req.session.loginusername = users[0].username;
            req.session.loginrole = users[0].roleid;
            req.session.loginperms = users[0].permissions;
            if (checkredirect(redirect))
                res.redirect(redirect);
        } else {
            res.redirect(vroot + "login?" + qs.stringify(Object.assign(req.query, { error: 4 })));
        }
    }
}));
router.get(vroot + "logout", async(async function (req, res) {
    if (req.session.loginid !== -1)
        req.logger.log("debug", "logging out %s", req.user.username);
    var redirect = typeof req.query.redirect === "undefined" ? vroot : req.query.redirect;
    req.session.loginid = -1;
    if (checkredirect(redirect))
        res.redirect(redirect);
}));

module.exports = router;
