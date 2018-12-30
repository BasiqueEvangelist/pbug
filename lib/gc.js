var connection = require("./knexfile");
var fs = require("fs");
var dbg = require("debug")("pbug:files:gc");

var gc = async function () {
    fs.readdirSync("./files/").forEach(async function (d) {
        if ((await connection.select("id").from("files").where("uid", d)).length < 1) {
            dbg("deleting file " + d);
            fs.unlinkSync("./files/" + d);
        }
    });
};

module.exports = () => gc().then(() => { });
if (require.main === module) module.exports();