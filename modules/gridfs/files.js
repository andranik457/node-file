
const mongoose      = require("mongoose");
const Busboy        = require("busboy");
//
const { connFiles } = require("../../connections/mongo");
const { BadRequestException, PayloadTooLargeException, NotFoundException } = require("../error/index");
//
const bucket        = mongoose.mongo;

const uploadFileByFormData = (req) => {
    const gfs = new bucket.GridFSBucket(connFiles.db, { bucketName: "fs" });

    let busboy = new Busboy({
        headers: req.headers,
        limits: {
            fileSize: 6 * 1024 * 1024
        }
    });

    return new Promise((resolve, reject) => {
        let writeStream = null;

        busboy.on("file", function (fieldName, file, fileName, encoding, mimeType) {

            if (!fieldName) {
                reject(new BadRequestException("key is empty"));
            }

            if (mimeType === "image/png" || mimeType === "image/jpg" || mimeType === "image/jpeg" || mimeType === "image/pjpeg") {

                writeStream = gfs.openUploadStream(fileName, { contentType: mimeType });
                file.pipe(writeStream);

                file.on("limit", function () {
                    reject(new PayloadTooLargeException());
                });

                writeStream.on("error", (err) => {
                    return reject(new BadRequestException(err));
                });

                let writeStreamId   = writeStream.id;

                writeStream.on("finish", () => {
                    resolve({ fileId: writeStreamId });
                });
            }
            else {
                reject(new BadRequestException("wrong format"));
            }
        });

        req.pipe(busboy);
    });
};

module.exports = {

    getFile: (req, res, next) => {
        const id = req.params.id.split(".")[0];
        let gfs = new bucket.GridFSBucket(connFiles.db, { bucketName: "fs" });

        let data = null;
        try {
            data = gfs.find({ _id: mongoose.Types.ObjectId(id) });
        } catch (e) {
            return next(new BadRequestException("invalid profile image id"));
        }

        if (!data) {
            console.log('aaaaa');
        }
        data.toArray((err, docs) => {
            if (err) {
                console.log('aaaaa');
            }
            res.header("Content-Type", docs && docs[0] && docs[0].contentType ? docs[0].contentType : process.env.PROFILE_IMAGE_DEFAULT_TYPE);

            let downloadStream = gfs.openDownloadStream(mongoose.Types.ObjectId(id));

            downloadStream.on("error", () => {
                console.log('aaaaa');
            });
            downloadStream.on("data", (chunk) => {
                // On Stream
                // console.log( chunk.length )
            }).pipe(res);
            downloadStream.on("end", function () {
                docs = null;
                gfs = null;
                downloadStream = null;
                res.send();
            });
        });
    },

    async setFile (req) {
        return new Promise((resolve, reject) => {
            // if (req.headers["content-type"].match(/multipart\/form-data/)) {
                return resolve(uploadFileByFormData(req));
            // }
        });
    },

};