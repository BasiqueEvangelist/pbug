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
                    "authorid": req.user.id === -1 ? null : req.user.id,
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
                .from("users"),
            roles: await connection
                .select("*")
                .from("roles")
        });
    }));
    app.post(vroot + "admin/users/:user/rerole", needsPermission("roles.rerole"), async(async function (req, res, next) {
        if (typeof req.params.user === typeof undefined) {
            res.status(400).end();
            return;
        }
        else if (isNaN(Number(req.params.user))) {
            res.status(400).end();
            return;
        }
        if (typeof req.body.roleid === typeof undefined) {
            res.status(400).end();
            return;
        }
        else if (isNaN(Number(req.body.roleid))) {
            res.status(400).end();
            return;
        }

        var users = await connection
            .select("id")
            .from("users")
            .where({
                "id": Number(req.params.user)
            });
        if (users.length < 1) {
            res.status(400).end();
            return;
        }
        var roles = await connection
            .select("id", "permissions")
            .from("roles")
            .where({
                "id": Number(req.body.roleid)
            });
        if (roles.length < 1) {
            res.status(400).end();
            return;
        }
        await connection("users")
            .where({
                "id": Number(req.params.user)
            })
            .update({
                "roleid": req.body.roleid
            });
        var sessions = await connection
            .select("sid", "sess")
            .from("sessions");
        for (var session of sessions) {
            var data = JSON.parse(session.sess);
            if (data.loginid === Number(req.params.user)) {
                data.loginperms = roles[0].permissions;
                data.loginrole = req.body.roleid;
                await connection("sessions")
                    .where({
                        "sid": session.sid
                    })
                    .update({
                        "sess": JSON.stringify(data)
                    });
            }
        }
        req.session.reload((err) => {
            if (err) next(err);
            else res.redirect(vroot + "admin/users/");
        })
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
    app.get(vroot + "admin/roles", needsPermission("roles.list"), async(async function (req, res, next) {
        res.render("admin/roles/view", {
            roles: await connection
                .select("*")
                .from("roles")
        });
    }));
    app.post(vroot + "admin/roles/create", needsPermission("roles.create"), async(async function (req, res, next) {
        if (typeof req.body.name === typeof undefined) {
            res.status(400).end();
            return;
        }
        else if (typeof req.body.permissions === typeof undefined) {
            res.status(400).end();
            return;
        }
        await connection("roles")
            .insert({
                "name": req.body.name,
                "permissions": req.body.permissions
            });
        res.redirect(vroot + "admin/roles/");
    }));
    app.get(vroot + "admin/roles/:role/edit", needsPermission("roles.edit"), async(async function (req, res, next) {
        if (typeof req.params.role === typeof undefined) {
            req.redirect(vroot + "admin/roles");
            return;
        }
        else if (isNaN(Number(req.params.role))) {
            req.redirect(vroot + "admin/roles");
            return;
        }
        var roles = await connection
            .select("id", "name", "permissions")
            .from("roles")
            .where({
                "id": Number(req.params.role)
            });
        if (roles.length < 1) {
            res.redirect(vroot + "admin/roles");
            return;
        }
        res.render("admin/roles/edit", {
            role: roles[0]
        });
    }));
    app.post(vroot + "admin/roles/:role/edit", needsPermission("roles.edit"), async(async function (req, res, next) {
        if (typeof req.params.role === typeof undefined) {
            res.status(400).end();
            return;
        }
        else if (isNaN(Number(req.params.role))) {
            res.status(400).end();
            return;
        }
        else if (typeof req.body.name === typeof undefined) {
            res.status(400).end();
            return;
        }
        else if (typeof req.body.permissions === typeof undefined) {
            res.status(400).end();
            return;
        }
        var roles = await connection
            .select("id", "name", "permissions")
            .from("roles")
            .where({
                "id": Number(req.params.role)
            });
        if (roles.length < 1) {
            res.status(400).end();
            return;
        }
        await connection("roles")
            .where({
                "id": Number(req.params.role)
            })
            .update({
                "name": req.body.name,
                "permissions": req.body.permissions
            });
        var sessions = await connection
            .select("sid", "sess")
            .from("sessions");
        for (var session of sessions) {
            var data = JSON.parse(session.sess);
            if (typeof data.loginperms !== typeof undefined) {
                if (data.loginrole === Number(req.params.role)) {
                    data.loginperms = req.body.permissions;
                    await connection("sessions")
                        .where({
                            "sid": session.sid
                        })
                        .update({
                            "sess": JSON.stringify(data)
                        });
                }
            }
        }
        req.session.reload((err) => {
            if (err) next(err);
            else res.redirect(vroot + "admin/roles/");
        });
    }));
};
