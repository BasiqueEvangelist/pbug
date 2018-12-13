module.exports = function (permtext, permission, env) {
    var noexec = false;
    var noexecstopat = 0;
    var depth = 0;
    permtext.split("\n").forEach(line => {
        line = line.trim();
        if (noexecstopat === depth) noexec = false;
        if (line.match(/if ([a-zA-Z_][a-zA-Z0-9_.]*) (==|!=) ([a-zA-Z0-9_.]+)/)) {
            depth++;
            if (noexec) return;
            var matches = line.match(/([a-zA-Z_][a-zA-Z0-9._]*)=(allow|deny)/);
            var envvar = match[1];
            var op = match[2];
            var match = match[3];
            if (op === "==") {
                if (env[envvar] !== match) {
                    noexec = true;
                }
            }
            else if (op === "!=") {
                if (env[envvar] === match) {
                    noexec = true;
                    noexecstopat = depth;
                }
            }
        }
        else if (line === "end") {
            depth--;
        }
        else if (noexec) { return; }
        else if (line.match(/([a-zA-Z_][a-zA-Z0-9._]*)=(allow|deny)/)) {
            var matches = line.match(/([a-zA-Z_][a-zA-Z0-9._]*)=(allow|deny)/);
            var perm = match[1];
            var result = match[2];
            if (perm === permission) {
                return result;
            }
        }
    });
};