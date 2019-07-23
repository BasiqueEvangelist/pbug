var { requiresAdministrator } = require("./common");
var paginate = require("express-paginate");
module.exports = function (app, connection, debug, config) {
    var vroot = config["virtual-root"];

    app.get(vroot + "admin/", requiresAdministrator, async function (req, res, next) {
        if (!req.user.isadmin) res.redirect(vroot);
        else res.render("admin/index");
    });
    app.get(vroot + "admin/createproject", requiresAdministrator, async function (req, res, next) {
        if (!req.user.isadmin) res.redirect(vroot);
        else res.render("admin/createproject");
    });
    app.post(vroot + "admin/createproject", requiresAdministrator, async function (req, res, next) {
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
    });
    app.get(vroot + "admin/users", requiresAdministrator, async function (req, res, next) {
        res.render("admin/viewusers", {
            users: await connection
                .select("users.*")
                .from("users")
        });
    });
    app.get(vroot + "admin/invites", requiresAdministrator, async function (req, res, next) {
        res.render("admin/invites/list", {
            invites: await connection
                .select("invites.*")
                .from("invites")
        });
    });
    app.post(vroot + "admin/invites/create", requiresAdministrator, async function (req, res, next) {
        var uid = require("crypto").randomBytes(48).toString("base64").replace(/\//g, "_").replace(/\+/g, "-");
        await connection("invites")
            .insert({
                "uid": uid
            });
        res.redirect(vroot + "admin/invites");
    });
    app.get(vroot + "admin/invites/:invite/remove", requiresAdministrator, async function (req, res, next) {
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
    });

    // app.get(vroot + "admin/files/search", requiresAdministrator, paginate.middleware(), async function (req, res, next) {
    //     var query = (typeof req.query.q == "undefined") ? "" : req.query.q;
    //     function buildfrom(q, order) {
    //         var builder = connection
    //             .from("files")
    //             .leftJoin("users AS authors", "files.authorid", "authors.id");
    //         var orderDesc = true;
    //         q.split(" ").forEach(function (d) {
    //             if (d.length == 0) { return; }
    //             else if (d.startsWith("author:")) {
    //                 var authorName = d.slice("author:".length);
    //                 builder = builder.where("authors.username", "ilike", authorName);
    //             }
    //             else if (d.startsWith("order:")) {
    //                 var order = d.slice("order:".length);
    //                 if (order.match(/asc/gi))
    //                     orderDesc = false;
    //             }
    //             else {
    //                 builder = builder.where("files.filename", "ilike", "%" + d + "%");
    //             }
    //         });
    //         if (order)
    //             builder = builder.orderBy("files.id", orderDesc ? "DESC" : "ASC");
    //         return builder;
    //     }
    //     var reslen = (await buildfrom(query, false).count("*"))[0].count;
    //     var results = await buildfrom(query, true)
    //         .select("files.*", "authors.username")
    //         .offset(req.skip)
    //         .limit(req.query.limit);
    //     var pagec = Math.ceil(reslen / req.query.limit);
    //     res.render("admin/files/search",
    //         {
    //             query: query,
    //             results: results,
    //             pages: paginate.getArrayPages(req)(5, pagec, req.query.page)
    //         });
    // })
};
