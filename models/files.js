
/**
 * Module dependencies
 */

const mongoose  = require("mongoose");
const Schema    = mongoose.Schema;
let { connNotifications } = require("../connections/mongo");

const filesSchema = new Schema({
    userId:         { type: String },
    notifications:  { type: Array }
}, {
    versionKey: false
});

const FilesModel = connNotifications.model("FilesModel", filesSchema, "files");

module.exports = {
    FilesModel
};
