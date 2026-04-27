import { z } from 'zod';

export const tagQuerySchema = z.object({
    RelationType: z.string().max(100).optional(),
});

export const inquirySchema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(5000),
    category: z.string().max(100).optional(),
    email: z.string().email().max(255).optional(),
});
export type InquiryInput = z.infer<typeof inquirySchema>;
