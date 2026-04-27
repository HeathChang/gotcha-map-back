import { z } from 'zod';

export const bookmarkBodySchema = z.object({
    type: z.enum(['store', 'product']),
    targetId: z.string().min(1),
});
export type BookmarkInput = z.infer<typeof bookmarkBodySchema>;
