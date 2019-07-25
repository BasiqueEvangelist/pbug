var connection = require("./knexfile");

exports.provePermission = async function (roleid, permission) {

    var roles = await connection
        .select("permissions")
        .from("roles")
        .where({
            "id": roleid
        });
    if (roles < 1) throw new Error("Role doesn't exist)");
    for (var permmatch of roles[0].permissions.split(";"))
        if (exports.matchPermission(permmatch.split("."), permission.split(".")))
            return true;
    return false;
};

exports.matchPermission = function (matchwords, permwords) {
    if (permwords.length < matchwords.length)
        return false;
    var matchindex = 0;
    var permindex = 0;
    while (matchindex < matchwords.length) {
        if (matchwords[matchindex] === "**") permindex = permwords.length - (matchwords.length - matchindex);
        else if (matchwords[matchindex] !== permwords[permindex] && matchwords[matchindex] !== "*") return false;
        matchindex++;
        permindex++;
    }
    return permindex === permwords.length;
};