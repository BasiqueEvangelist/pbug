var connection = require("../knexfile");
var diff = require("diff");

exports.processActivities = async function (issue) {
    var activities = (await connection
        .select("issueactivities.id", "dateofoccurance",
            "issueid", "authorid",
            "data", "users.fullname")
        .from("issueactivities")
        .leftJoin("users", "issueactivities.authorid", "users.id")
        .where({
            "issueid": issue
        })
        .orderBy("issueactivities.id", "asc")).map(function (a) {
            a.data = JSON.parse(a.data);
            return a;
        });

    var users = await connection
        .select("id", "fullname")
        .from("users");

    return activities.map(function (t) {
        if (t.data.type === "editpost" || t.data.type === "editissue") {
            t.oldtext = [];
            t.newtext = [];
            var da = diff.diffLines(t.data.from.text, t.data.to.text);
            da.forEach(function (d, i) {
                if (typeof d.added === typeof undefined) d.added = false;
                if (typeof d.removed === typeof undefined) d.removed = false;
                if (!d.removed && !d.added) {
                    t.oldtext.push([d.value, ""]);
                    t.newtext.push([d.value, ""]);
                }
                else if (d.removed) {
                    t.oldtext.push([d.value, "red"]);
                    if (i === da.length - 1)
                        t.newtext.push([" ", "filler"]);
                    else {
                        if (!da[i + 1].added)
                            t.newtext.push([" ", "filler"]);
                    }
                }
                else {
                    if (i === 0)
                        t.oldtext.push([" ", "filler"]);
                    else {
                        if (!da[i - 1].removed)
                            t.oldtext.push([" ", "filler"]);
                    }
                    t.newtext.push([d.value, "green"]);
                }
            });
            if (t.data.type === "editissue")
                if (t.data.to.assigneeid !== "-1")
                    t.newassigneename = users.find((user) => user.id === parseInt(t.data.to.assigneeid)).fullname;
            return t;
        }
        else {
            return t;
        }
    });
};