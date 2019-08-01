var { provePermission } = require("../permissions");

exports.proveSecrecy = function (perms, secrecy) {
    for (var i = secrecy; i < 256; i++) {
        if (provePermission(perms, "kb.secrecy." + i.toString()))
            return true;
    }
    return false;
};

exports.getMaxSecrecy = function (perms) {
    for (var i = 255; i >= 0; i--) {
        if (provePermission(perms, "kb.secrecy." + i.toString()))
            return i;
    }
    return false;
};