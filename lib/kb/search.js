var express = require("express");
var router = new express.Router();
var config = require("../config");
var vroot = config["virtual-root"];
var connection = require("../knexfile");
var paginate = require("express-paginate");
var debug = require("../debug");
var { async, needsPermission } = require("../common");

router.get(vroot + "kb", function (req, res) {
    res.redirect(vroot + "kb/search");
});
router.get(vroot + "kb/search", needsPermission("kb.search"), paginate.middleware(), async(async function (req, res, next) {
    var query = (typeof req.query.q === "undefined") ? "" : req.query.q;
    function buildfrom(q, order) {
        var builder = connection
            .from("infopages")
            .leftJoin("users AS authors", "infopages.authorid", "authors.id");
        var orderDesc = true;
        q.split(" ").forEach(function (d) {
            if (d.length === 0) { return; }
            else if (d[0] === "#") {
                builder = builder.where(function (bld) {
                    bld.where(connection.raw("lower(infopages.pagetags) like ?", d.slice(1) + "%"))
                        .orWhere(connection.raw("lower(infopages.pagetags) like ?", "%" + d.slice(1) + "%"))
                        .orWhere(connection.raw("lower(infopages.pagetags) like ?", "%" + d.slice(1)));
                });
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
                builder = builder.where(connection.raw("lower(infopages.pagename) like ?", "%" + d + "%"));
            }
        });
        if (order)
            builder = builder.orderBy("infopages.id", orderDesc ? "DESC" : "ASC");
        return builder;
    }
    var reslen = (await buildfrom(query, false).count("*"))[0].count;
    var results = await buildfrom(query, true)
        .select({
            "authorname": "authors.username"
        })
        .select("infopages.*")
        .offset(req.skip)
        .limit(req.query.limit);
    var pagec = Math.ceil(reslen / req.query.limit);
    res.render("kb/search",
        {
            query: query,
            results: results,
            pages: paginate.getArrayPages(req)(5, pagec, req.query.page),
            pagec: Math.ceil(reslen / req.query.limit)
        });
}));

module.exports = router;
