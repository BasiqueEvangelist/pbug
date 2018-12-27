var { requiresAdministrator } = require("./common");
module.exports = function (app, connection, debug, config) {
    app.get("/admin/createproject", requiresAdministrator, async function (req, res, next) {
        if (!req.user.isadmin) res.redirect("/");
        else res.render("createproject");
    });
    app.post("/admin/createproject", requiresAdministrator, async function (req, res, next) {
        if (typeof req.body.name !== typeof "string") res.status(400).end();
        else if (typeof req.body.shortprojectid !== typeof "string") res.status(400).end();
        else if (req.body.shortprojectid.length > 3 || req.body.shortprojectid === 0) res.status(400).end();
        else {
            await connection("projects")
                .insert({
                    "projectname": req.body.name,
                    "authorid": req.session.loginid,
                    "shortprojectid": req.body.shortprojectid
                })
            res.redirect("/");
        }
    });
    app.get("/admin/users", requiresAdministrator, async function (req, res, next) {
        res.render("admin/viewusers", {
            users: await connection
                .select("users.*")
                .from("users")
        })
    });
    app.get("/admin/invites/create", requiresAdministrator, async function (req, res, next) {
        res.render("admin/invites/create")
    });
    app.post("/admin/invites/create", requiresAdministrator, async function (req, res, next) {
        if (typeof req.body.name !== typeof "") {
            res.status(400).end();
        }
        else if (typeof req.body.username !== typeof "") {
            res.status(400).end();
        }
        else if (req.body.name === "") {
            res.status(400).end();
        }
        else if (req.body.username === "") {
            res.status(400).end();
        }
        else {
            if ((await connection
                .select("id")
                .from("invites")
                .where({
                    "username": req.body.username
                })).length > 0) {
                res.redirect("/admin/invites/create");
            }
            var uid = require('crypto').randomBytes(48).toString('base64').replace(/\//g, '_').replace(/\+/g, '-');
            await connection("invites")
                .insert({
                    "username": req.body.username,
                    "fullname": req.body.name,
                    "uid": uid
                });
            res.redirect("/admin/invites")
        }
    });
    app.get("/admin/invites/:invite/remove", requiresAdministrator, async function (req, res, next) {
        if (typeof req.params.invite !== typeof "") {
            res.redirect("/admin/invites")
        }
        else if (req.params.length === 0) {
            res.redirect("/admin/invites")
        }
        else {
            await connection("invites")
                .where({
                    "uid": req.params.invite
                })
                .del();
            res.redirect("/admin/invites")
        }
    });
    app.get("/admin/invites", requiresAdministrator, async function (req, res, next) {
        res.render("admin/invites/list", {
            invites: await connection
                .select("invites.*")
                .from("invites")
        })
    });
};