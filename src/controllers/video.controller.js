const fs = require('fs');
const path = require('path');
const prisma = require('../utils/prisma');
const {
  uploadFileToFirebase,
  deleteFileFromFirebase,
} = require('../services/firebase-storage.service');
const { ENROLLMENT_STATUS_ACTIVE } = require('../config/constants');

// Video controller uses LessonResource model (resourceId = videoId in routes)
const uploadVideo = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { title } = req.body;
    const userId = req.userId;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const lessonIdInt = parseInt(lessonId);
    if (isNaN(lessonIdInt)) {
      return res.status(400).json({ error: 'Invalid lesson ID' });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { lessonId: lessonIdInt },
      include: {
        module: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    if (lesson.module.course.instructorId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const useLocalStorage = process.env.USE_LOCAL_VIDEO_STORAGE === 'true';
    let videoUrl;

    if (useLocalStorage) {
      const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
      videoUrl = `${baseUrl.replace(/\/$/, '')}/uploads/${req.file.filename}`;
    } else {
      const uploadResult = await uploadFileToFirebase(
        req.file,
        'videos',
        title ? `${title}-${Date.now()}` : undefined
      );
      videoUrl = uploadResult.url;
    }

    const lessonResource = await prisma.lessonResource.create({
      data: {
        lessonId: lessonIdInt,
        title: title || req.file.originalname,
        fileUrl: videoUrl,
        fileType: 'video',
      },
    });

    res.status(201).json({
      resourceId: lessonResource.resourceId,
      lessonId: lessonResource.lessonId,
      title: lessonResource.title,
      videoUrl: lessonResource.fileUrl,
      fileType: lessonResource.fileType,
    });
  } catch (error) {
    console.error('Upload video error:', error.message, error.stack);
    const msg = String(error.message || '');
    let responseMsg = msg;
    if (error.response && error.response.data) {
      const d = error.response.data;
      if (typeof d === 'object' && d.error && typeof d.error.message === 'string') {
        responseMsg = d.error.message;
      } else if (typeof d === 'string') {
        try {
          const parsed = JSON.parse(d);
          if (parsed.error && parsed.error.message) responseMsg = parsed.error.message;
        } catch (_) {}
      }
    }
    const isBucketNotFound =
      typeof responseMsg === 'string' && responseMsg.toLowerCase().includes('bucket does not exist');
    const isFirebaseUnavailable = msg.includes('Firebase') || isBucketNotFound;
const status = isFirebaseUnavailable ? 503 : 500;
    const message = isBucketNotFound
      ? 'Storage bucket not found. Enable Firebase Storage and set FIREBASE_STORAGE_BUCKET in .env'
      : isFirebaseUnavailable
        ? 'Upload service unavailable'
        : 'Internal server error';
    res.status(status).json({ error: message });
  }
};

/** If existingLessonResource is provided (with lesson.module.course), skips loading it again. */
async function checkVideoAccess(prisma, userId, resourceIdInt, existingLessonResource = null) {
  const lessonResource =
    existingLessonResource ||
    (await prisma.lessonResource.findUnique({
      where: { resourceId: resourceIdInt },
      include: {
        lesson: {
          include: {
            module: {
              include: { course: { select: { courseId: true, instructorId: true } } },
            },
          },
        },
      },
    }));
  if (!lessonResource || lessonResource.fileType !== 'video') return { allowed: false, notFound: true };
  const courseId = lessonResource.lesson.module.course.courseId;
  const instructorId = lessonResource.lesson.module.course.instructorId;
  const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
  if (instructorId === userIdNum) return { allowed: true };
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: userIdNum, courseId } },
  });
  return { allowed: !!enrollment && enrollment.status === ENROLLMENT_STATUS_ACTIVE };
}

const getVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const resourceIdInt = parseInt(videoId);
    const userId = req.userId;

    if (isNaN(resourceIdInt)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    const lessonResource = await prisma.lessonResource.findUnique({
      where: { resourceId: resourceIdInt },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    });

    if (!lessonResource || lessonResource.fileType !== 'video') {
      return res.status(404).json({ error: 'Video not found' });
    }

    const access = await checkVideoAccess(prisma, userId, resourceIdInt, lessonResource);
    if (access.notFound) return res.status(404).json({ error: 'Video not found' });
    if (!access.allowed) return res.status(403).json({ error: 'Not authorized to access this video' });

    res.json({
      resourceId: lessonResource.resourceId,
      lessonId: lessonResource.lessonId,
      title: lessonResource.title,
      videoUrl: lessonResource.fileUrl,
      fileType: lessonResource.fileType,
      lesson: lessonResource.lesson,
    });
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const streamVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
const resourceIdInt = parseInt(videoId);
    const userId = req.userId;

    if (isNaN(resourceIdInt)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    const access = await checkVideoAccess(prisma, userId, resourceIdInt);
    if (access.notFound) return res.status(404).json({ error: 'Video not found' });
    if (!access.allowed) return res.status(403).json({ error: 'Not authorized to access this video' });

    const lessonResource = await prisma.lessonResource.findUnique({
      where: { resourceId: resourceIdInt },
    });

    res.redirect(lessonResource.fileUrl);
  } catch (error) {
    console.error('Stream video error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const downloadVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const resourceIdInt = parseInt(videoId);
    const userId = req.userId;

    if (isNaN(resourceIdInt)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    const access = await checkVideoAccess(prisma, userId, resourceIdInt);
    if (access.notFound) return res.status(404).json({ error: 'Video not found' });
    if (!access.allowed) return res.status(403).json({ error: 'Not authorized to access this video' });

    const lessonResource = await prisma.lessonResource.findUnique({
      where: { resourceId: resourceIdInt },
    });

    const downloadUrl = lessonResource.fileUrl.replace(
      '?alt=media',
      '?alt=media&download=true'
    );
    res.redirect(downloadUrl);
  } catch (error) {
    console.error('Download video error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const userId = req.userId;
    const userRoles = req.userRoles || [];
    const resourceIdInt = parseInt(videoId);

    if (isNaN(resourceIdInt)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    const lessonResource = await prisma.lessonResource.findUnique({
      where: { resourceId: resourceIdInt },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    });

    if (!lessonResource || lessonResource.fileType !== 'video') {
      return res.status(404).json({ error: 'Video not found' });
    }

    const isAdmin = userRoles.includes('admin');
    const isInstructor =
      lessonResource.lesson.module.course.instructorId === userId;

    if (!isAdmin && !isInstructor) {
      return res.status(403).json({ error: 'Not authorized to delete this video' });
    }

    try {
      const fileUrl = lessonResource.fileUrl || '';
      const localMatch = fileUrl.match(/\/uploads\/([^/?]+)$/);
      if (localMatch) {
        const uploadsDir = path.join(__dirname, '../../uploads');
const filePath = path.join(uploadsDir, localMatch[1]);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } else {
        const urlParts = fileUrl.split('/o/');
        if (urlParts.length > 1) {
          const filePath = decodeURIComponent(urlParts[1].split('?')[0]);
          await deleteFileFromFirebase(filePath);
        }
      }
    } catch (fileError) {
      console.error('Error deleting video file:', fileError);
    }

    await prisma.lessonResource.delete({
      where: { resourceId: resourceIdInt },
    });

    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  uploadVideo,
  getVideo,
  streamVideo,
  downloadVideo,
  deleteVideo,
};