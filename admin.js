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
};