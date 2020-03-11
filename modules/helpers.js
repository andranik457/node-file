
/**
 * Module dependencies
 */

const _ = require("lodash");
const crypto = require("crypto");

/**
 * Update parameter in url
 * @param {String} url
 * @param {String} paramName
 * @param {String} paramValue
 * @returns {String}
 */

function replaceUrlParam (url, paramName, paramValue) {
    if (paramValue === null) {
        paramValue = "";
    }
    let pattern = new RegExp("\\b(" + paramName + "=).*?(&|#|$)");
    if (url.search(pattern) >= 0) {
        return url.replace(pattern, "$1" + paramValue + "$2");
    }
    url = url.replace(/[?#]$/, "");
    return url + (url.indexOf("?") > 0 ? "&" : "?") + paramName + "=" + paramValue;
}

function getSubjectById (key) {
    const types = {
        I: "isrc",
        T: "track",
        R: "release",
        P: "playlist",
        U: "user"
    };
    return types[key];
}

function getSubject (code) {
    if (!code.match(/^[ITRPU]-[0-9A-Za-z]+$/)) {
        throw new Error("Invalid key format");
    }
    const [key, value] = code.split("-");
    return {
        subject: getSubjectById(key),
        subjectId: value
    };
}

function getIdBySubject (key) {
    const types = {
        isrc: "I",
        track: "T",
        release: "R",
        playlist: "P",
        user: "U"
    };
    return types[key];
}

/**
 * Get Subject By Id
 * @param {String} type
 * @param {String} item
 * @returns {String}
 */

/**
 * Helper Nampspace
 */

const helper = {

    /**
     * Create milliseconds From 30 days
     * @returns {number}
     */

    calcTime: () => {
        const day = 60 * 60 * 24;
        const quantity = 30;
        return day * quantity;
    },

    /**
     * Sort One Array With The Other One
     * @param {Array} sorting
     * @param {Array} items
     * @param {String} type
     * @returns {Array}
     */

    sortByArray: (sorting, items, type) => {
        const result = [];
        _.each(sorting, id => {
            result.push(_.find(items, item => item[type] === id));
        });
        return result;
    },

    /**
     * Make All Request Values Lowercase
     * @param {Object} req
     * @param {Object} res
     * @param {Function} next
     */

    makeReqVariablesLowercase: (req, res, next) => {
        let key, keys = Object.keys(req.query);
        let n = keys.length;
        let newobj = {};
        while (n--) {
            key = keys[n];
            newobj[key.toLowerCase()] = req.query[key];
        }
        req.query = newobj;
        return next();
    },

    createLink: (type, item) => {
        return "trebel://" + type + "?" + (type === "blog" ? "action" : "id") + "=" + item;
    },

    /**
     * Get store
     * @param {store} store
     * @returns {String}
     */

    getStore: (store) => {
        return store === "MX" ? "MX" : "US";
    },

    /**
     * Get WishList default Id
     * @param {String} userId
     * @returns {String}
     */

    getUserDefaultWishListId: (userId) => {
        return `${userId}/default/wishlist`;
    },

    /**
     * Get Wishlist default Id
     * @param {String} query
     * @returns {String}
     */

    setQueryOffsets (query) {
        query.limit = parseInt(query.limit) || 20;
        query.skip = parseInt(query.skip) || 0;
        if (query.limit > 100 || query.limit < 1) { query.limit = 20; }
        if (query.skip < 0) { query.limit = 0; }
        return query;
    },

    verifyQuerySignature (query, secret) {
        /* Validate */
        if (!("timestamp" in query) || !("signature" in query)) {
            return false;
        }

        const string = String(query.timestamp) + secret;
        const signature = crypto.createHash("md5").update(string).digest("hex");

        return String(query.signature) === signature;
    },

    itemsRollResponse (req, items, options) {
        let response = { items: items };
        if (items.length) {
            let url = options.host + req.originalUrl;
            if (options.params) {
                for (let key in options.params) {
                    if (options.params.hasOwnProperty(key)) {
                        url = replaceUrlParam(url, key, options.params[key]);
                    }
                }
            }
            response.nextPageUrl = url;
        }
        return response;
    },

    response: (result) => {
        return {
            status: "OK",
            result: result || {}
        };
    },

    isEmptyObject (obj) {
        if (obj === null) {
            return true;
        }
        for (let prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                return false;
            }
        }

        return JSON.stringify(obj) === JSON.stringify({});
    },

    isEmptyArray (arr) {
        return !!(arr && arr.length === 0);
    },

    getRequestIp (req) {
        return req.headers["cf-connecting-ip"] ||
            req.headers["client-ip"] ||
            req.headers["x-forwarded-for"] ||
            req.headers["x-forwarded"] ||
            req.headers["forwarded-for"] ||
            req.headers["forwarded"] ||
            req.connection.remoteAddress ||
            "0.0.0.0";
    },

    getSubject,
    getSubjectById,
    getIdBySubject,
    replaceUrlParam,

    expressWrapperMutate (cb, mutation) {
        return async (req, res, next) => {
            try {
                const data = await cb(req, res, next);
                res.json({ status: "OK", result: mutation(data) || {} });
            } catch (err) {
                next(err);
            }
        };
    },

    expressWrapper (cb) {
        return async (req, res, next) => {
            try {
                const data = await cb(req, res, next);
                res.json({ status: "OK", result: data || {} });
            } catch (err) {
                next(err);
            }
        };
    },

    expressWrapperClean (cb) {
        return async (req, res, next) => {
            try {
                const data = await cb(req, res, next);
                res.json(data || {});
            } catch (err) {
                next(err);
            }
        };
    },

    expressWrapperRedirect (cb) {
        return async (req, res, next) => {
            try {
                const link = await cb(req, res, next);
                res.redirect(link);
            } catch (err) {
                next(err);
            }
        };
    }

};

module.exports = helper;
