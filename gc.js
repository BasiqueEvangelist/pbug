var connection = require("./knexfile");
var fs = require("fs");
var dbg = require("debug")("pbug:files:gc");

var gc = async function () {
    var files = await connection.select().from('files');
    files.forEach(async function (d) {
        if (!fs.existsSync("files/" + d.uid)) {
            dbg("deleting file db entry " + d.uid);
            await connection('files').where("uid", d.uid).del();
        }
    });
    fs.readdirSync("./files/").forEach(async function (d) {
        if ((await connection.select("id").from("files").where("uid", d)).length < 1) {
            dbg("deleting file " + d);
            fs.unlinkSync("./files/" + d);
        }
    });
};

module.exports = () => gc().then(() => { });
if (require.main === module) module.exports();