
const { connAds, connAudio, connIcon } = require("../connections/mongo");
const { TracksModelUS, ReleasesModelUS, ArtistsModelUS, TracksModelMX, ReleasesModelMX, ArtistsModelMX } = require("../models/tracks");
const { TokenModel, PlaylistsTracksModel, CheckinsModel } = require("../models/defaults");

const { FilesModel } = require("../models/files");

const moment = require("moment");
const mongoose = require("mongoose");
const parseRange = require("range-parser");
const _ = require("lodash");
const winston = require("winston");

// I know, it's fucking bad, but the only way ))
const Grid = require("gridfs-stream");
const streamBuffers = require("stream-buffers");
eval(`Grid.prototype.findOne = ${Grid.prototype.findOne.toString().replace("nextObject", "next")}`);
Grid.mongo = mongoose.mongo;


const gridfs        = require("gridfs-stream" );

function getTracksModel (type, store) {
    if (String(store).toUpperCase() === "MX") {
        switch (type) {
        case "track": return TracksModelMX;
        case "release": return ReleasesModelMX;
        case "artist": return ArtistsModelMX;
        }
        return null;
    }
    switch (type) {
    case "track": return TracksModelUS;
    case "release": return ReleasesModelUS;
    case "artist": return ArtistsModelUS;
    }
}

const mongo = {

    getTracksModel,

    findToken: (bearer, next) => {
        TokenModel.findOne({ bearer }, null, { lean: true })
            .then(doc => {
                if (_.isEmpty(doc)) {
                    return next({ status: 401, message: "Token is not found" });
                }
                return next(null, doc);
            }, err => next(err));
    },

    getTracksConcise: async (trackIds = [], store) => {
        if (!trackIds.length) { return []; }

        const tracks = await getTracksModel("track", store).find(
            { trackId: { $in: trackIds }, deletedAt: null },
            { trackId: true, title: true, releaseId: true, artistAppearsAs: true },
            { lean: true }
        );

        if (!tracks.length) { return []; }

        let releaseIds = tracks.map(one => { return one.releaseId; });

        // unique
        releaseIds.filter((value, index, self) => {
            return self.indexOf(value) === index;
        });

        // get releases
        const releases = await getTracksModel("release", store).find(
            { releaseId: { $in: releaseIds }, deletedAt: null },
            { releaseId: true, image: true },
            { lean: true }
        );

        // set release by id
        let releasesById = {};
        releases.map(release => {
            return releasesById[release.releaseId] = release;
        });

        let result = {};
        tracks.map(track => {
            if (track.releaseId in releasesById) {
                result[track.trackId] = {
                    title: track.title,
                    artist: track.artistAppearsAs,
                    image: releasesById[track.releaseId].image
                };
            }
        });

        return result;
    },

    getPlaylistTracks: (playlistId, limit, skip, next) => {
        PlaylistsTracksModel.find({ playlistId, deletedAt: null }, null, { limit, skip, lean: true, sort: { modifiedTime: -1, _id: -1 } })
            .then(doc => next(null, doc), err => next(err));
    },

    updateCheckins: (userId, name, data, next) => {
        const query = { $and: [{ "userId": userId }, { "nameAndAddress": name }] };
        CheckinsModel.findOne(query, "timestamp", { lean: true })
            .then(doc => {
                if (_.isEmpty(doc)) {
                    CheckinsModel.create(data, (err, edoc) => {
                        err ? next(err) : (edoc.allow = "1", edoc.timestamp = 0, next(null, edoc));
                    });
                    return;
                }
                const firstMoment = moment(new Date());
                const timestamp = moment.unix(doc.timestamp);
                const days = firstMoment.diff(timestamp, "days");
                if (days >= 1) {
                    CheckinsModel.findOneAndUpdate({ userId }, data, { lean: true })
                        .then(fdoc => (fdoc.allow = "1", next(null, fdoc)), err => next(err));
                    return;
                }
                doc.allow = "0";
                return next(null, doc);
            }, err => next(err));
    },

    getIcon: (id, next) => {
        let gfs = Grid(connIcon.db);
        gfs.findOne({ _id: id }, (err, file) => {
            if (err) return next({ status: 503, message: err.message || "Service unavailable" });
            if (!file) return next({ status: 404, message: err || "Not Found" });
            let readStream = gfs.createReadStream({ _id: id });
            readStream.on("error", () => {
                winston.log("error", err);
            });
            readStream.on("open", () => {
                next(null, readStream, file);
            });
            readStream.on("end", () => {
                file = null;
                gfs = null;
                readStream = null;
            });
        });
    },

    getResourceAd: (req, res, filename, type, next) => {
        let gfs = type === "ads" ? Grid(connAds.db) : Grid(connAudio.db);
        gfs.findOne({ filename }, (err, file) => {
            if (err) return next({ status: 503, message: err.message || "Service unavailable" });
            if (!file) return next({ status: 404, message: err || "Not Found" });
            mongo.streamAds(req, res, gfs, file, next);
        });
    },

    streamAds: (req, res, gfs, file, next) => {
        let readStream;
        if (req.headers.range) {
            let range = parseRange(file.length, req.headers.range, { combine: true });
            file.start = parseInt(range[0].start, 10);
            file.end = range[0].end ? parseInt(range[0].end, 10) : file.length - 1;
            file.chunksize = (file.end - file.start) + 1;
            readStream = gfs.createReadStream({
                _id: file._id,
                range: { startPos: file.start, endPos: file.end }
            });
            res.writeHead(206, {
                "Content-Range": "bytes " + file.start + "-" + file.end + "/" + file.length,
                "Content-Length": file.chunksize,
                "Content-Type": file.contentType,
                "ETag": file.md5,
                "Last-Modified": file.uploadDate
            });
            readStream.on("data", chunk => {
                file.start += chunk.length;
                next(null, chunk, file);
            });
            return;
        }
        readStream = gfs.createReadStream({ _id: file._id });
        readStream.on("error", (err) => {
            next({ message: err.message });
        });
        readStream.on("open", () => {
            next(null, readStream, file);
        });
    },


};

module.exports = mongo;
