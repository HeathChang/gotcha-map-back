import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../config/database';
import { TagRow, AnnouncementRow, InquiryRow } from '../types';

const TAG_COLUMNS = 'tag_id, name, relation_type, created_at';
const ANNOUNCEMENT_COLUMNS = 'announce_id, title, content, is_active, created_at, updated_at';
const INQUIRY_COLUMNS =
    'inquiry_id, user_id, title, content, category, email, status, answer, answered_at, created_at, updated_at';

export type TagResponse = {
    tagId: string;
    name: string;
    relationType: string | null;
    createdAt: Date;
};

export type AnnouncementResponse = {
    announceId: string;
    title: string;
    content: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export type InquiryResponse = {
    inquiryId: string;
    userId: string;
    title: string;
    content: string;
    category: string | null;
    email: string | null;
    status: InquiryRow['status'];
    answer: string | null;
    answeredAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

function toTag(row: TagRow): TagResponse {
    return {
        tagId: row.tag_id,
        name: row.name,
        relationType: row.relation_type,
        createdAt: row.created_at,
    };
}

function toAnnouncement(row: AnnouncementRow): AnnouncementResponse {
    return {
        announceId: row.announce_id,
        title: row.title,
        content: row.content,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function toInquiry(row: InquiryRow): InquiryResponse {
    return {
        inquiryId: row.inquiry_id,
        userId: row.user_id,
        title: row.title,
        content: row.content,
        category: row.category,
        email: row.email,
        status: row.status,
        answer: row.answer,
        answeredAt: row.answered_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export async function getTagList(relationType?: string) {
    const rows = relationType
        ? await query<TagRow[]>(
              `SELECT ${TAG_COLUMNS} FROM tags WHERE relation_type = ? ORDER BY name`,
              [relationType],
          )
        : await query<TagRow[]>(`SELECT ${TAG_COLUMNS} FROM tags ORDER BY name`);
    return rows.map(toTag);
}

export async function getAnnouncementList() {
    const rows = await query<AnnouncementRow[]>(
        `SELECT ${ANNOUNCEMENT_COLUMNS} FROM announcements WHERE is_active = TRUE ORDER BY created_at DESC`,
    );
    return rows.map(toAnnouncement);
}

export async function postInquiry(
    userId: string,
    title: string,
    content: string,
    category?: string,
    email?: string,
) {
    const inquiryId = uuidv4();
    return withTransaction(async (conn) => {
        await conn.query(
            `INSERT INTO inquiries (inquiry_id, user_id, title, content, category, email)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [inquiryId, userId, title, content, category ?? null, email ?? null],
        );
        const rows = (await conn.query(
            `SELECT ${INQUIRY_COLUMNS} FROM inquiries WHERE inquiry_id = ?`,
            [inquiryId],
        )) as InquiryRow[];
        return toInquiry(rows[0]);
    });
}

export async function getInquiryList(userId: string) {
    const rows = await query<InquiryRow[]>(
        `SELECT ${INQUIRY_COLUMNS} FROM inquiries WHERE user_id = ? ORDER BY created_at DESC`,
        [userId],
    );
    return rows.map(toInquiry);
}
