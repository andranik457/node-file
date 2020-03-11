
const redisRequests = require("../dbQueries/redisRequests");
const mongoRequests = require("../dbQueries/mongoRequests");
const helperFunction = require("../modules/helpers");
const tokenFunction = require("../modules/token");
const async = require("async");
const moment = require("moment");
const winston = require("winston");
const { redisClient } = require("../dbQueries/redisRequests");
const { getCountriesSettings, getGroupsSettings } = require("../modules/globals");

function setRequestUserSettingsCallback (req, params, cb) {
    let settings = getGroupsSettings();
    if (Object.keys(settings).length) {
        return cb(setRequestUserSettings(req, params));
    }
    if (!req.recursiveAttempt) {
        req.recursiveAttempt = 0;
    }
    if (req.recursiveAttempt++ === 5) {
        cb({ message: "Server Unavailable", status: 503 });
    }
    setTimeout(() => {
        setRequestUserSettingsCallback(req, params, cb);
    }, 500);
}

function setRequestUserSettings (req, params) {
    let { groupId, countryCode, extraGroupId, useMode } = params;
    if (!req.user) {
        req.user = {};
    }
    if (groupId) {
        req.user.group = getGroupsSettings(groupId);
    }
    let extraGroup = null;
    if (extraGroupId) {
        req.user.group = extraGroup = getGroupsSettings(extraGroupId);
    }
    if (countryCode) {
        req.user.country = getCountriesSettings(countryCode);
    }
    /* set group from country */
    if (!req.user.group && req.user.country) {
        let { groups } = req.user.country;
        req.user.group = groups[Object.keys(groups)[0]];
    }
    /* set default group */
    if (!req.user.group) {
        req.user.group = getGroupsSettings(process.env.GROUP_DEFAULT_ID);
    }
    /* set country */
    if (!req.user.country) {
        req.user.country = req.user.group && req.user.group.country
            ? req.user.group.country
            : getCountriesSettings(process.env.GROUP_DEFAULT_COUNTRY);
    }
    /* set group as main country first group */
    if (!extraGroup && req.user.country.mainCountry) {
        let { groups } = req.user.country.mainCountry;
        let group = groups[Object.keys(groups)[0]];
        if (group) {
            req.user.group = group;
        }
    }
    req.user.store = req.user.country.mainCountry
        ? req.user.country.mainCountry.store
        : req.user.country.store;
    req.user.groupId = req.user.group._id.toString();
    req.user.countryCode = req.user.country.name;
    req.user.useMode = useMode;
    if (req.user.countryCode.toLowerCase() === "default") {
        req.user.countryCode = req.user.country.mainCountry
            ? req.user.country.mainCountry.name
            : "";
    }
}

const auth = {
    freeAuth: (req, res, next) => {
        setRequestUserSettingsCallback(req, {
            groupId: req.query.groupId,
            extraGroupId: req.query.extraGroupId,
            countryCode: req.query.country,
            useMode: "anonymous"
        }, next);
    },
    userAuth: (req, res, next) => {
        if (!req.headers.authorization) {
            next({ status: 401, message: "Unauthorized: header authorization is missing" });
            return;
        }
        const decode = tokenFunction.decodeToken(req.headers.authorization);
        if (!redisClient.connected) {
            auth.mongoAuth(decode.bearer, (err, result) => {
                if (err) return next(err);
                setRequestUserSettingsCallback(req, {
                    groupId: result.groupId,
                    extraGroupId: req.query.extraGroupId,
                    countryCode: result.country,
                    useMode: ((result.useMode || result.mode) && (result.useMode || result.mode)) || null
                }, next);
            });
            return;
        }
        async.series([
            callback => {
                auth.redisAuth(decode, err => err ? callback(null) : next());
            },
            callback => {
                auth.mongoAuth(decode.bearer, (err, result) => {
                    err ? callback(err, null) : callback(null, result);
                });
            }
        ], (err, result) => {
            if (err) return next(err);
            async.parallel([
                () => next(),
                () => {
                    tokenFunction.userToRedis(result[1], err => {
                        if (err) return winston.log("error", err);
                    });
                }
            ]);
        });
    },
    redisAuth: (decode, next) => {
        async.waterfall([
            callback => {
                const accessToken = tokenFunction.createTokenMask(decode);
                const timestamp = "timestamp";
                redisRequests.getToken(accessToken, timestamp, err => {
                    err ? callback(err, null) : callback(null, accessToken, timestamp);
                });
            },
            (accessToken, timestamp, callback) => {
                const time = moment(new Date()).unix();
                redisRequests.updateTimestamp(accessToken, timestamp, time, err => {
                    err ? callback(err, null) : callback(null, accessToken);
                });
            },
            (accessToken, callback) => {
                const expireTime = helperFunction.calcTime();
                redisRequests.expireToken(accessToken, expireTime, err => {
                    err ? callback(err, null) : callback(null);
                });
            }
        ], err => err ? next(err) : next());
    },
    mongoAuth: (token, next) => {
        mongoRequests.findToken(token, (err, result) => next(err, result));
    }
};

module.exports = auth;
