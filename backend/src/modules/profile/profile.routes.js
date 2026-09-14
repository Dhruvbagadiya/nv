import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { updateProfileBody, changePasswordBody } from './profile.schemas.js';
import {
  getProfileHandler,
  updateProfileHandler,
  changePasswordHandler,
  uploadAvatarHandler,
} from './profile.controller.js';
import { BadRequestError } from '../../utils/httpErrors.js';
import { IMAGE_TYPES, IMAGE_TYPE_ADVICE, AVATAR_MAX_BYTES } from '../../utils/storage.js';

const router = Router();

// The shared list, not a third copy of it. This one had drifted already: it was
// still PNG/JPEG/WebP after GIF and AVIF were added for logos, so the same file
// an admin could upload as a school logo was refused as their own avatar.
const ALLOWED_MIME = Object.keys(IMAGE_TYPES);
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(new BadRequestError(
      IMAGE_TYPE_ADVICE[file.mimetype]
      ?? `Unsupported image type "${file.mimetype}". Use PNG, JPEG, WebP, GIF or AVIF.`
    ));
  },
});

// All authenticated users — every role can manage their own profile.
router.get('/',               requireAuth, asyncHandler(getProfileHandler));
router.put('/',               requireAuth, validate(updateProfileBody), asyncHandler(updateProfileHandler));
router.post('/password',      requireAuth, validate(changePasswordBody), asyncHandler(changePasswordHandler));
router.post('/avatar',        requireAuth, avatarUpload.single('avatar'), asyncHandler(uploadAvatarHandler));

export default router;
