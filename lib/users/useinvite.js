var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var sha512 = require("crypto-js/sha512");
var qs = require("qs");
var { mksalt, hashpassword, checkredirect } = require("./common");

router.get(vroot + "useinvite", async function (req, res) {
    if (req.session.loginid !== -1) res.redirect(vroot);
    else
        if (config.login.allowregistration == "open")
            res.redirect(vroot + "register?" + qs.stringify(req.query));
        else if (config.login.allowregistration == "inviteonly")
            res.render("useinvite");
        else
            res.render("regclosed");
});
router.post(vroot + "useinvite", async function (req, res) {
    if (req.session.loginid !== -1) {
        debug.userapi("registration only for anonymous users");
        res.redirect(vroot);
    } else if (config.login.allowregistration !== "inviteonly") {
        debug.userapi("registration disallowed")
        res.redirect(vroot);
    } else if (typeof req.body.inviteid !== typeof "string") {
        debug.userapi("inviteid is of incorrect type");
        res.redirect(vroot + "useinvite?" + qs.stringify(Object.assign(req.query, { error: 7 })));
    } else if (req.body.inviteid === "") {
        debug.userapi("inviteid empty");
        res.redirect(vroot + "useinvite?" + qs.stringify(Object.assign(req.query, { error: 7 })));
    } else if (typeof req.body.username !== typeof "string") {
        debug.userapi("username of incorrect type");
        res.redirect(vroot + "register?" + qs.stringify(Object.assign(req.query, { error: 0 })));
    } else if (typeof req.body.name !== typeof "string") {
        debug.userapi("full name of incorrect type");
        res.redirect(vroot + "register?" + qs.stringify(Object.assign(req.query, { error: 2 })));
    } else if (typeof req.body.password !== typeof "string") {
        debug.userapi("password is of incorrect type");
        res.redirect(vroot + "useinvite?" + qs.stringify(Object.assign(req.query, { error: 1 })));

    } else if (req.body.password === "") {
        debug.userapi("password empty");
        res.redirect(vroot + "useinvite?" + qs.stringify(Object.assign(req.query, { error: 1 })));
    }
    else {
        var redirect = typeof req.query.redirect == "undefined" ? vroot : req.query.redirect;
        debug.userapi("registration request for %s", req.body.username);
        var invites = await connection
            .select()
            .from("invites")
            .where("uid", req.body.inviteid);
        if (invites.length < 1) {
            debug.userapi("invite %s already exists", req.body.inviteid);
            res.redirect(vroot + "useinvite?" + qs.stringify(Object.assign(req.query, { error: 6 })));
            return;
        }
        var salt = await mksalt();
        debug.userapi("generated salt for %s", req.body.username);
        var apikey = sha512(Math.floor(Math.random() * 1000000).toString()).toString();
        debug.userapi("generated apikey %s for %s", apikey, req.body.username);
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
        debug.userapi("created user %s", req.body.username);
        await connection("invites")
            .where("uid", req.body.inviteid)
            .del();
        debug.userapi("removed invite %s", req.body.inviteid);
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
