var qs = require("qs");

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