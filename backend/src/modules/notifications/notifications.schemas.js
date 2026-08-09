import { z } from 'zod';
import { queryBool } from '../../utils/queryTypes.js';

export const listNotificationsQuery = z.object({
  unreadOnly: queryBool,
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const idParam = z.object({ id: z.string().uuid() });
