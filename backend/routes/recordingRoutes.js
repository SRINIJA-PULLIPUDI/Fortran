const express = require('express');
const multer = require('multer');
const { uploadRecording, listRecordings, UPLOAD_DIR } = require('../controllers/recordingController');
const { protect, adminOnly } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${req.user._id}_${Date.now()}.webm`;
    cb(null, unique);
  },
});

// 500MB cap per recording upload - adjust to taste
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

const router = express.Router();

router.post('/', protect, upload.single('recording'), uploadRecording);
router.get('/', protect, adminOnly, listRecordings);

module.exports = router;
