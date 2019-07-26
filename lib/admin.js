var { needsPermission, async } = require("./common");
var paginate = require("express-paginate");
module.exports = function (app, connection, debug, config) {
    var vroot = config["virtual-root"];

    app.get(vroot + "admin/", needsPermission("admin.show"), async(async function (req, res, next) {
        res.render("admin/index");
    }));
    app.get(vroot + "admin/createproject", needsPermission("admin.createproject"), async(async function (req, res, next) {
        res.render("admin/createproject");
    }));
    app.post(vroot + "admin/createproject", needsPermission("admin.createproject"), async(async function (req, res, next) {
        if (typeof req.body.name !== typeof "string") res.status(400).end();
        else if (typeof req.body.shortprojectid !== typeof "string") res.status(400).end();
        else if (req.body.shortprojectid.length > 3 || req.body.shortprojectid === 0) res.status(400).end();
        else {
            await connection("projects")
                .insert({
                    "projectname": req.body.name,
                    "authorid": req.session.loginid,
                    "shortprojectid": req.body.shortprojectid
                });
            res.redirect(vroot);
        }
    }));
    app.get(vroot + "admin/users", needsPermission("users.list"), async(async function (req, res, next) {
        res.render("admin/viewusers", {
            users: await connection
                .select("users.*", "roles.name as rolename")
                .leftJoin("roles", "users.roleid", "roles.id")
                .from("users")
        });
    }));
    app.get(vroot + "admin/invites", needsPermission("users.invites"), async(async function (req, res, next) {
        res.render("admin/invites/list", {
            invites: await connection
                .select("invites.uid", "roles.name as rolename")
                .leftJoin("roles", "invites.roleid", "roles.id")
                .from("invites"),
            roles: await connection
                .select("id", "name")
                .from("roles")
        });
    }));
    app.post(vroot + "admin/invites/create", needsPermission("users.invites"), async(async function (req, res, next) {
        if (typeof req.body.roleid === typeof undefined) {
            res.status(400).end();
            return;
        } else if (isNaN(Number(req.body.roleid))) {
            res.status(400).end();
            return;
        }
        var uid = require("crypto").randomBytes(48).toString("base64").replace(/\//g, "_").replace(/\+/g, "-");
        await connection("invites")
            .insert({
                "uid": uid,
                "roleid": Number(req.body.roleid)
            });
        res.redirect(vroot + "admin/invites");
    }));
    app.get(vroot + "admin/invites/:invite/remove", needsPermission("users.invites"), async(async function (req, res, next) {
        if (typeof req.params.invite !== typeof "") {
            res.redirect(vroot + "admin/invites");
        }
        else if (req.params.length === 0) {
            res.redirect(vroot + "admin/invites");
        }
        else {
            await connection("invites")
                .where({
                    "uid": req.params.invite
                })
                .del();
            res.redirect(vroot + "admin/invites");
        }
    }));
};
