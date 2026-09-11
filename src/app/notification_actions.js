'use server';
import sql from '../lib/db.js';
import { revalidatePath } from 'next/cache';

const NOTIFICATION_VISIBLE_HOURS = 48; // notification đã đọc & cũ hơn ngưỡng này sẽ không còn hiện trong danh sách (vẫn còn nguyên trong DB)

export async function getNotifications(limit = 30) {
  try {
    const rows = await sql`
      SELECT * FROM notifications
      WHERE is_read = false
         OR created_at > NOW() - make_interval(hours => ${NOTIFICATION_VISIBLE_HOURS})
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows;
  } catch (err) {
    console.error("Failed to fetch notifications:", err);
    return [];
  }
}

export async function getUnreadNotificationCount() {
  try {
    const [row] = await sql`SELECT COUNT(*)::int AS count FROM notifications WHERE is_read = false`;
    return row?.count || 0;
  } catch (err) {
    console.error("Failed to get unread notification count:", err);
    return 0;
  }
}

export async function markNotificationRead(id) {
  try {
    await sql`UPDATE notifications SET is_read = true WHERE id = ${id}`;
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    console.error("Failed to mark notification as read:", err);
    return { success: false, error: err.message };
  }
}

export async function markAllNotificationsRead() {
  try {
    await sql`UPDATE notifications SET is_read = true WHERE is_read = false`;
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    console.error("Failed to mark all notifications as read:", err);
    return { success: false, error: err.message };
  }
}
