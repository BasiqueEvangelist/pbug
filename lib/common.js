var qs = require("qs");
var connection = require("./knexfile");
var connect_busboy = require("connect-busboy");
var fs = require("fs");
var crypto = require("crypto");
var permissions = require("./permissions");

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

exports.requiresAdministrator = function (req, res, next) {
    if (!(req.user.isadmin && req.user.id !== -1)) {
        if ((req.method === "GET" || req.method === "HEAD") && req.user.id === -1)
            res.redirect(req.vroot + "login?" + qs.stringify({ redirect: req.path }));
        else if (req.method === "GET" || req.method === "HEAD")
            res.status(403).render("errors/403admin");
        else
            res.status(403).json({
                error: {
                    type: "NotAuthorizedAsAdmin",
                    message: "This service requires admin privileges."
                },
                server: "PBug/0.1"
            }).end();
    }
    else
        next();
};

exports.requiresPermission = function (perm, env, defaultv) {
    return [exports.requiresLogin, async function (req, res, next) {
        var pass = true;
        if (req.user.role === undefined) pass = defaultv;
        else if (req.user.isadmin) pass = true;
        else {
            var roles = await connection
                .select("roles.*")
                .from("roles")
                .where({
                    "roles.id": req.user.role
                });
            pass = permissions(roles[0].permissions, perm, env);
        }
        if (!pass)
            if (req.method === "GET" || req.method === "HEAD")
                res.status(403).render("errors/403perm", { permission: perm });
            else
                res.status(403).json({
                    error: {
                        type: "NotAuthorized",
                        message: "This service requires permission " + perm + "."
                    },
                    server: "PBug/0.1"
                }).end();
        else
            next();
    }];
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
            if (res.locals.config.features.files)
                req.busboy.on('file', addprom(async function (fieldname, file, filename, encoding, mimetype) {
                    var fileid = require('crypto').randomBytes(48).toString('base64').replace(/\//g, '_').replace(/\+/g, '-');
                    if (filename !== "") {
                        file.pipe(fs.createWriteStream("files/" + fileid));
                        await connection("files")
                            .insert({
                                "filename": filename,
                                "authorid": req.user.id,
                                "uid": fileid
                            });
                        console.log(await connection("files").select())
                        req.files[fieldname] = fileid;
                    }
                    else {
                        file.on("data", function () { });
                        file.on("end", function () { });
                    }
                }));
            req.busboy.on('field', addprom(async function (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
                req.body[fieldname] = val;
            }));
            req.busboy.on('finish', async function () {
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