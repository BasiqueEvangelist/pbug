var express = require("express");
var router = new express.Router();
var config = require("../config");
var vroot = config["virtual-root"];
var connection = require("../knexfile");
var paginate = require("express-paginate");
var { async, needsPermission } = require("../common");

router.get(vroot + "issues", function (req, res) {
    res.redirect(vroot + "issues/search");
});
router.get(vroot + "issues/search", needsPermission("issues.search"), paginate.middleware(), async(async function (req, res, next) {
    var query = (typeof req.query.q === "undefined") ? "" : req.query.q;
    function buildfrom(q, order) {
        var builder = connection
            .from("issues")
            .leftJoin("projects", "issues.projectid", "projects.id")
            .leftJoin("users AS assignees", "issues.assigneeid", "assignees.id")
            .leftJoin("users AS authors", "issues.authorid", "authors.id");
        var orderDesc = true;
        q.split(" ").forEach(function (d) {
            if (d.length === 0) { return; }
            else if (d[0] === "#") {
                builder = builder.where(function (bld) {
                    bld.where(connection.raw("lower(issues.issuetags) like ?", d.slice(1) + "%"))
                        .orWhere(connection.raw("lower(issues.issuetags) like ?", "%" + d.slice(1) + "%"))
                        .orWhere(connection.raw("lower(issues.issuetags) like ?", "%" + d.slice(1)));
                });
            }
            else if (d.startsWith("status:")) {
                var status = d.slice("status:");
                if (status.match(/close/gi)) {
                    builder = builder.where("issues.isclosed", true);
                }
                else if (status.match(/open/gi)) {
                    builder = builder.where("issues.isclosed", false);
                }
            }
            else if (d.startsWith("project:")) {
                var projectCode = d.slice("project:".length);
                builder = builder.where(connection.raw("lower(projects.shortprojectid) like ?", projectCode));
            }
            else if (d.startsWith("assignee:")) {
                var assigneeName = d.slice("assignee:".length);
                if (assigneeName === "me" && req.user.id !== -1)
                    builder = builder.where("assignees.id", req.user.id);
                else if (assigneeName === "none")
                    builder = builder.where("issues.assigneeid", null);
                else
                    builder = builder.where(connection.raw("lower(assignees.username) like ?", assigneeName));
            }
            else if (d.startsWith("author:")) {
                var authorName = d.slice("author:".length);
                if (authorName === "me" && req.user.id !== -1)
                    builder = builder.where("authors.id", req.user.id);
                else
                    builder = builder.where(connection.raw("lower(authors.username) like ?", authorName));
            }
            else if (d.startsWith("order:")) {
                var order = d.slice("order:".length);
                if (order.match(/asc/gi))
                    orderDesc = false;
            }
            else {
                builder = builder.where(connection.raw("lower(issues.issuename) like ?", "%" + d + "%"));
            }
        });
        if (order)
            builder = builder.orderBy("issues.id", orderDesc ? "DESC" : "ASC");
        return builder;
    }
    var reslen = (await buildfrom(query, false).count("*"))[0].count;
    var results = await buildfrom(query, true)
        .select({
            "shortprojectid": "projects.shortprojectid",
            "assigneename": "assignees.username",
            "authorname": "authors.username"
        })
        .select("issues.*")
        .offset(req.skip)
        .limit(req.query.limit);
    var pagec = Math.ceil(reslen / req.query.limit);
    res.render("issues/search",
        {
            query: query,
            results: results,
            pages: paginate.getArrayPages(req)(5, pagec, req.query.page),
            pagec: Math.ceil(reslen / req.query.limit)
        });
}));

module.exports = router;
