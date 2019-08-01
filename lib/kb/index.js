var express = require("express");
var router = new express.Router();
var config = require("../config");
var vroot = config["virtual-root"];
var connection = require("../knexfile");
var paginate = require("express-paginate");
var debug = require("../debug");
var { async, needsPermission } = require("../common");
var { getMaxSecrecy } = require("./common");

router.get(vroot + "kb", function (req, res) {
    res.redirect(vroot + "kb/view/main");
});

module.exports = router;
