
/**
 * Module Dependencies
 */

const app   = require("express")();
const path  = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
//
const logger        = require("morgan");
const winston       = require("winston");
const bodyParser    = require("body-parser");
const expressJwt    = require("express-jwt");
//
const files = require("./routes/image");

/* Express middleware */
app.use("/api", expressJwt({ secret: process.env.JWT_SECRET }));
app.use(bodyParser.urlencoded({ extended: false, type: "application/x-www-form-urlencoded" }));
app.use(bodyParser.text({ type: "application/x-www-form-urlencoded", limit: "6mb" }));
app.use(bodyParser.raw({ type: "image/*", limit: "6mb" }));
app.use(bodyParser.json({
    type: function (v) {
        if (v.headers["content-type"]) {
            if (v.headers["content-type"].match(/multipart\/form-data/)) {
                return false;
            }
        }
        return true;
    },
    limit: "6mb"
}));
app.use(logger("dev"));
app.use((req, res, next) => {
    if (req.method === "OPTIONS") {
        if (req.headers["access-control-request-headers"]) {
            res.header("Access-Control-Allow-Headers", req.headers["access-control-request-headers"]);
        }
        return res.send();
    }
    next();
});
app.use((req, res, next) => {
    const os = req.headers["app-os"] && req.headers["app-os"].match(/android/i) ? "Android" : "iOS";
    const bn = req.headers["app-build-number"] && !isNaN(req.headers["app-build-number"]) ? parseInt(req.headers["app-build-number"]) : 0;
    req.device = { os, bn, is: (i) => os.toLowerCase() === i.toLowerCase() };
    next();
});

app.use((req, res, next) => {
    if (req.headers["token"] !== "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMTM2ODg0NDMiLCJkZXZpY2VJZCI6IjI1OTQ5MDc4IiwidHJhbnNhY3Rpb25JZCI6MCwiaWF0IjoxNTgzOTMxODA2fQ.UyCB0LN0QwrfrI0yx-cDDl_pSgYuCYcxFOhoTWsAluk") {
        return res.json({ error: "Please check token and try again" });
    }
    next();
});

/* Routes */
app.use("/files/",  files);

/* Production Error Handler */
app.use((err, req, res, next) => {
    let log = err;
    if (err.status === 400) { log = `400: ${err.message || "Bad Request"} : ${req.originalUrl}`; }
    if (err.status === 401) { log = `401: ${err.message || "Unauthorized error"} : ${req.originalUrl}`; }
    if (err.status === 404) { log = `404: ${err.message || "Not Found"} ${req.originalUrl}`; }
    winston.log("error", log);

    res.status(err.status || 500);
    const exception = err.exception || "Default";
    if (err.content) {
        return res.json({ error: err.content || {}, exception });
    }
    if (err.code && err.code.toString() === "11000") {
        return res.status(409).json({ message: "duplicate key error, please be sure you sent request once at a time", error: {}, exception });
    }
    res.json({ message: err.message, error: {}, exception });
});

/* Application Listening On PORT */
app.listen(process.env.SERVER_PORT, process.env.SERVER_HOSTNAME,
    winston.log("info", `Node.js server is running at http://${process.env.SERVER_HOSTNAME}:${process.env.SERVER_PORT} 
    in ${process.env.NODE_ENV} mode with process id ${process.pid}`)
);

/* Checking Uncaught Exceptions */
process.on("uncaughtException", err => {
    winston.log("error", (new Date()).toUTCString() + " uncaughtException:", err.message);
    winston.log("error", err.stack);
    process.exit(1);
});
