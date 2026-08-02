const path = require('path');
const fs = require('fs');
const Recording = require('../models/Recording');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'recordings');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// POST /api/recordings - multipart upload of a webm recording chunk/session
// Expects: file field "recording", body fields: contestId, startedAt, endedAt
async function uploadRecording(req, res, next) {
  try {
    const { contestId, startedAt, endedAt } = req.body;
    if (!req.file) return res.status(400).json({ message: 'recording file is required (field name: recording)' });
    if (!contestId) return res.status(400).json({ message: 'contestId is required' });

    const recording = await Recording.create({
      user: req.user._id,
      contest: contestId,
      filePath: req.file.path,
      fileSizeBytes: req.file.size,
      startedAt: startedAt || new Date(),
      endedAt: endedAt || undefined,
    });

    res.status(201).json({ recording: { id: recording._id, fileSizeBytes: recording.fileSizeBytes } });
  } catch (err) {
    next(err);
  }
}

// GET /api/recordings?contestId=... (admin) - list recordings for a contest
async function listRecordings(req, res, next) {
  try {
    const { contestId } = req.query;
    const filter = contestId ? { contest: contestId } : {};
    const recordings = await Recording.find(filter).populate('user', 'fullName userId');
    res.json({ recordings });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadRecording, listRecordings, UPLOAD_DIR };
