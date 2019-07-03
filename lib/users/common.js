var crypto = require("crypto");
var ITERATIONS = 100000;
var config = require("../config");
var vroot = config["virtual-root"];

exports.hashpassword = function (password, salt) {
    return new Promise(function (resolve, reject) {
        crypto.pbkdf2(password, salt, ITERATIONS, 64, "sha512", (error,key) => {
            if (error) reject(error);
            resolve(key.toString("hex"));
        });
    });
};

exports.mksalt = function () {
    return new Promise(function (resolve, reject) {
        crypto.randomBytes(32, (error,key) => {
            if (error) reject(error);
            resolve(key.toString("hex"));
        });
    });
};

exports.checkredirect = function (url) {
    if (!url.startsWith(vroot)) return false;
    if (url.startsWith("//")) return false;
    return true;
};
