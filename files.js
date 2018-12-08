var connect_busboy = require("connect-busboy");
var fs = require("fs");
var crypto = require("crypto");
module.exports = function (app, connection, debug) {
    app.get("/files/upload", async function (req, res, next) {
        if (req.user.id === -1) res.redirect("/");
        res.render("files/upload");
    });
    app.post("/files/upload", connect_busboy({ immediate: true }), async function (req, res, next) {
        if (req.user.id === -1) res.status(403).end();
        else
            req.busboy.on('file', async function (fieldname, file, filename, encoding, mimetype) {
                var fileid = require('crypto').randomBytes(48).toString('base64').replace(/\//g, '_').replace(/\+/g, '-');
                file.pipe(fs.createWriteStream("files/" + fileid));
                await connection("files")
                    .insert({
                        "filename": filename,
                        "authorid": req.user.id,
                        "uid": fileid
                    });
                res.redirect("/");
            });
    });
};