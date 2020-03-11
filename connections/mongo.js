
const winston   = require("winston");
const mongoose  = require("mongoose");
//
mongoose.Promise = Promise;

const options = (db) => {
    const opt = {
        url: process.env[`MONGO_${db}_HOST`],
        options: {
            useNewUrlParser:    process.env[`MONGO_${db}_USE_NEW_URL_PARSER`]               || true,
            autoReconnect:      process.env[`MONGO_${db}_AUTO_RECONNECT`]                   || false,
            bufferCommands:     process.env[`MONGO_${db}_BUFFER_COMMAND`]                   || false,
            bufferMaxEntries:   parseInt(process.env[`MONGO_${db}_BUFFER_MAX_ENTRIES`])     || 0,
            connectTimeoutMS:   parseInt(process.env[`MONGO_${db}_CONNECTION_TIMEOUT_MS`])  || 30000,
            poolSize:           parseInt(process.env[`MONGO_${db}_POOL_SIZE`])              || 50
        }
    };

    if (process.env[`MONGO_${db}_REPLICA_SET`]) {
        opt.options.replicaSet      = process.env[`MONGO_${db}_REPLICA_SET`];
        opt.options.readPreference  = process.env[`MONGO_${db}_READ_PREFERENCE`] || "secondaryPreferred";
    }

    return opt;
};

const createConnection = (conf, connection) => {
    connection = mongoose.createConnection(conf.url, conf.options);

    connection.on("disconnected", (e) => {
        winston.log("error", "Reconnecting to " + conf.url);
        setTimeout(() => { createConnection(conf, connection); }, 5000);
    });

    connection.on("error", (e) => {
        winston.log("error", e);
    });

    connection.on("open", () => {
        winston.log("info", "Connected to " + conf.url);
    });

    return connection;
};

let connFiles = createConnection(options("FILE"));

module.exports = {
    connFiles
};
