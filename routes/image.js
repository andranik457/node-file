
const router                = require("express").Router();
const { expressWrapper }    = require("../modules/helpers");
const { getFile, setFile }  = require("../modules/gridfs/files");

router.get("/getFile/:id",  getFile);
router.put("/setFile",      expressWrapper(setFile));

module.exports = router;