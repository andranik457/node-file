
const router = require("express").Router();
const { expressWrapper, expressWrapperRedirect } = require("../modules/helpers");
const geoIPFunction = require("../modules/geoIP");

router.get("/country/by/ip/:ip", (req, res) => {
    geoIPFunction.get(req.params.ip, result => res.send(result));
});

/* 404 */
router.use((req, res, next) => {
    const err = new Error("Not Found");
    err.status = 404;
    next(err);
});

module.exports = router;
