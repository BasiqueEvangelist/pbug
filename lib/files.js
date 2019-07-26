var path = require("path");
var { async, needsPermission } = require("./common");

module.exports = function (app, connection, debug, config) {
    var vroot = config["virtual-root"];
    app.get(vroot + "file/:uid", needsPermission("issues.view.posts"), async(async function (req, res) {
        if (typeof req.params.uid === typeof undefined) {
            req.redirect(config.vroot);
        }
        else {
            var files = await connection
                .select("filename")
                .from("issuefiles")
                .where({
                    "fileid": req.params.uid
                });
            if (files.length < 1) {
                res.status(404).render("errors/404");
            }
            else {
                res.sendFile(req.params.uid, {
                    root: "files",
                    dotfiles: "deny",
                    headers: {
                        "content-disposition": "attachment; filename=\"" + files[0].filename + "\""
                    }
                });
            }
        }
    }));
};
