var qs = require("qs");
var connection = require("./knexfile");

exports.requiresLogin = function (req, res, next) {
    if (req.user.id === -1) {
        if (req.method === "GET" || req.method === "HEAD")
            res.redirect("/login?" + qs.stringify({ redirect: req.path }));
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
            res.redirect("/login?" + qs.stringify({ redirect: req.path }));
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

var permissions = require("./permissions");

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