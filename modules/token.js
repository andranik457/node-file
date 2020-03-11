
/**
 * Module dependencies
 */

const redisRequests = require("../dbQueries/redisRequests");
const helperFunction = require("./helpers");
const jwt = require("jsonwebtoken");
const async = require("async");
const redisClient = require("../dbQueries/redisRequests").redisClient;

const token = {

    /**
     * Store Token In Redis
     * @param {Object} user
     * @param {Function} next
     * @returns {*}
     */

    userToRedis: (user, next) => {
        const tokenMask = token.createTokenMask(user);
        if (redisClient.connected) {
            async.series([
                callback => {
                    redisRequests.deleteTokenKeys(user, err => {
                        err ? callback(err, null) : callback(null);
                    });
                },
                callback => {
                    redisRequests.setToken(tokenMask, user, err => {
                        err ? callback(err, null) : callback(null);
                    });
                },
                callback => {
                    const time = helperFunction.calcTime();
                    redisRequests.expireToken(tokenMask, time, err => {
                        err ? callback(err, null) : callback(null);
                    });
                }
            ], err => err ? next(err) : next());
            return;
        }
        next({ message: "Redis is not connected yet" });
    },

    // store token info in MongoDB

    // userToMongo : (user, next) => {
    //     mongoRequests.saveToken(user, (result) => {
    //         if (result.error) {
    //             next({error : result.error, message : result.message});
    //             return;
    //         }
    //         return next(result);
    //     });
    // },

    // // store token in Mongo and Redis (asynchronously)
    //
    // saveInMongoAndRedis: (tokenBody, next) => {
    //
    //     let user = token.genToken(tokenBody);
    //     async.series([
    //         (callback) => {
    //             token.userToMongo(user, (result) => {
    //                 (result.error) ? callback(result, null) : callback(null, result);
    //             });
    //         }
    //     ], (err, res) => {
    //         if (err) {
    //             next(err);
    //             return;
    //         }
    //         async.parallel([
    //             () => {
    //                 return next(res[0]);
    //             },
    //             () => {
    //                 token.userToRedis(user, (result) => {
    //                     if (undefined === result) {
    //                         next();
    //                         return;
    //                     }
    //                     return winston.log("error", result);
    //                 });
    //             }
    //         ]);
    //     });
    // },

    /**
     * Decode JWT
     * @param {Object} auth
     * @returns {{bearer: *, userId: (*|tokenSchema.userId|{type, required}), ... }}
     */

    decodeToken: auth => {
        const token = auth.split(" ");
        const decoded = jwt.verify(token[1], process.env.JWT_SECRET);
        return {
            bearer: token[1],
            userId: decoded.userId
        };
    },

    /**
     * Create Token Mask To Store In Redis
     * @param {Object} info
     * @returns {string}
     */

    createTokenMask: info => {
        const tokenType = "bearer";
        const userId = info.userId || info.user.userId;
        return `${tokenType}:${userId}:${info.bearer}`;
    }

};

module.exports = token;
