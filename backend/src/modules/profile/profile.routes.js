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

const router = Router();

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(new BadRequestError('Only PNG, JPEG or WebP images are accepted.'));
  },
});

// All authenticated users — every role can manage their own profile.
router.get('/',               requireAuth, asyncHandler(getProfileHandler));
router.put('/',               requireAuth, validate(updateProfileBody), asyncHandler(updateProfileHandler));
router.post('/password',      requireAuth, validate(changePasswordBody), asyncHandler(changePasswordHandler));
router.post('/avatar',        requireAuth, avatarUpload.single('avatar'), asyncHandler(uploadAvatarHandler));

export default router;
