exports.provePermission = function (userperms, permission) {
    for (var permmatch of userperms.split(";"))
        if (exports.matchPermission(permmatch.split("."), permission.split("."))) {
            return true;
        }
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