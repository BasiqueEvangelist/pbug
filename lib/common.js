var qs = require("qs");
var connection = require("./knexfile");
var connect_busboy = require("connect-busboy");
var fs = require("fs");
var crypto = require("crypto");
var { provePermission } = require("./permissions");

exports.requiresLogin = function (req, res, next) {
    if (req.user.id === -1) {
        if (req.method === "GET" || req.method === "HEAD")
            res.redirect(req.vroot + "login?" + qs.stringify({ redirect: req.path }));
        else
            res.status(403).json({
                error: {
                    type: "NotAuthenticated",
                    message: "This service requires authentication via session id."
                },
                server: "PBug/0.1"
            }).end();
    }
    else
        next();
};

exports.needsPermission = function (perm) {
    return [exports.requiresLogin, exports.async(async function (req, res, next) {
        if (!await provePermission(req.user.role, perm))
            exports.permissionError(req, res);
        else
            next();
    })];
};

exports.permissionError = function (req, res) {
    if (req.method === "GET" || req.method === "HEAD")
        res.status(403).render("errors/403permission");
    else
        res.status(403).json({
            error: {
                type: "NotAuthorized",
                message: "This service requires a permission that you don't have."
            },
            server: "PBug/0.1"
        }).end();
};

exports.catchFiles = function () {
    return [exports.requiresLogin, connect_busboy({}), async function (req, res, next) {
        if (req.method === "POST" && req.get("content-type").startsWith("multipart/form-data")) {
            req.files = {};
            req.body = {};
            var proms = [];
            function addprom(p) {
                return function () {
                    proms.push(p.apply(this, arguments));
                };
            }
            req.busboy.on("file", addprom(async function (fieldname, file, filename, encoding, mimetype) {
                var fileid = require("crypto").randomBytes(9).toString("base64").replace(/\//g, "_").replace(/\+/g, "-");
                if (filename !== "") {
                    file.pipe(fs.createWriteStream("files/" + fileid));
                    if (typeof req.files[fieldname] !== typeof [])
                        req.files[fieldname] = [];
                    req.files[fieldname].push({
                        uid: fileid,
                        filename: filename
                    });
                }
                else {
                    file.on("data", function () { });
                    file.on("end", function () { });
                }
            }));
            req.busboy.on("field", addprom(async function (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
                req.body[fieldname] = val;
            }));
            req.busboy.on("finish", async function () {
                await Promise.all(proms);
                next();
            });
            req.pipe(req.busboy);
        }
        else {
            next();
        }
    }];
};

exports.insertActivity = function (issueid, userid, data) {
    return connection("issueactivities")
        .insert({
            "dateofoccurance": new Date(),
            "issueid": issueid,
            "authorid": userid,
            "data": JSON.stringify(data)
        });
};

exports.async = function (func) {
    return (req, res, next) =>
        func(req, res, next).catch((err) => next(err));
};