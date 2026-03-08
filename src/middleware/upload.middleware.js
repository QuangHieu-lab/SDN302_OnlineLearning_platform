const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { VIDEO_MAX_BYTES, RESOURCE_MAX_BYTES } = require('../config/constants');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /mp4|avi|mov|wmv|flv|webm/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only video files are allowed'));
  }
};

const uploadVideo = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: VIDEO_MAX_BYTES,
  },
});

// Resources (documents): PDF, DOC, etc. - store in uploads/resources
const resourcesDir = path.join(__dirname, '../../uploads/resources');
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
}
const resourceStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, resourcesDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const resourceFileFilter = (req, file, cb) => {
  const allowed = /^(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip)$/;
  const ext = path.extname(file.originalname || '').toLowerCase().slice(1);
  if (allowed.test(ext)) return cb(null, true);
  cb(new Error('Only documents (PDF, DOC, etc.) are allowed'));
};
const uploadResource = multer({
  storage: resourceStorage,
  fileFilter: resourceFileFilter,
  limits: { fileSize: RESOURCE_MAX_BYTES },
});

// Thumbnails (course cover images)
const thumbnailsDir = path.join(__dirname, '../../uploads/thumbnails');
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}
const thumbnailStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, thumbnailsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, uniqueSuffix + ext);
  },
});
const thumbnailFileFilter = (req, file, cb) => {
  const allowed = /^image\/(jpeg|jpg|png|gif|webp)$/;
  if (file.mimetype && allowed.test(file.mimetype)) return cb(null, true);
  cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
};
const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const uploadThumbnail = multer({
  storage: thumbnailStorage,
  fileFilter: thumbnailFileFilter,
  limits: { fileSize: THUMBNAIL_MAX_BYTES },
});

module.exports = { uploadVideo, uploadResource, uploadThumbnail };
