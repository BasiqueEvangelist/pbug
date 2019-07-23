var express = require("express");
var router = new express.Router();
var connection = require("../knexfile");
var config = require("../config.js");
var vroot = config["virtual-root"];
var debug = require("../debug");
var { async } = require("../common");

router.post(vroot + "checkusername", async(async function (req, res) {
    var resu = await connection
        .select("id")
        .from("users")
        .where({
            "username": req.body.username
        });
    if (resu.length !== 1) {
        res.send("Username available");
    } else {
        res.send("Username taken");
    }
}));
router.post(vroot + "checkinvite", async(async function (req, res) {
    var resu = await connection
        .select("id")
        .from("invites")
        .where({
            "uid": req.body.inviteid
        });
    if (resu.length !== 1) {
        res.send("Invite exists");
    } else {
        res.send("Invite doesn't exist");
    }
}));

module.exports = router;
