var connection = require("./knexfile");

exports.provePermission = async function (userid, permission) {
    var users = await connection
        .select("roleid")
        .from("users")
        .where({
            "id": userid
        });
    if (users < 1) throw new Error("User doesn't exist");
    var roles = await connection
        .select("permissions")
        .from("roles")
        .where({
            "id": users[0].roleid
        });
    if (roles < 1) throw new Error("Invalid user (role doesn't exist)");
    for (var permmatch in roles[0].permissions.split(";"))
        if (exports.matchPermission(permmatch.split("."), permission.split(".")))
            return true;
    return false;
};

exports.matchPermission = function (matchwords, permwords) {
    if (permwords.length > matchwords && matchwords[matchwords.length - 1] === "**")
        return exports.matchPermission(matchwords.splice(0, 1), permwords.slice(0, matchwords.length - 1));
    else if (permwords.length < matchwords)
        return false;
    var matchindex, permindex = 0;
    while (matchindex < matchwords.length) {
        if (matchwords[matchindex] === "*") continue;
        else if (matchwords[matchindex] === "**") permindex = permwords.length - (matchwords.length - matchindex) - 1;
        else if (matchwords[matchindex] !== permwords[permindex]) return false;
        matchindex++;
        permindex++;
    }
    return permindex === permwords.length;
};