import {
  type NotificationType,
  Prisma,
  type PrismaClient,
  type UserRole,
} from '@prisma/client';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';

import { getPrismaClient } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

const defaultExpoClient = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

export type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  dedupKey?: string | null;
  actionUrl?: string | null;
  data?: Prisma.InputJsonValue;
};

export type NotificationListQuery = {
  unreadOnly?: boolean;
  type?: NotificationType;
  page?: number;
  limit?: number;
};

export type NotificationPreferencesInput = {
  bookingUpdates?: boolean;
  paymentAlerts?: boolean;
  payoutAlerts?: boolean;
  reminders?: boolean;
  marketing?: boolean;
  pushEnabled?: boolean;
  emailEnabled?: boolean;
};

export type RegisterPushDeviceInput = {
  pushToken: string;
  deviceType?: string | null;
};

export type BroadcastNotificationInput = {
  title: string;
  message: string;
  targetRole?: 'CUSTOMER' | 'PARTNER' | 'ALL';
  actionUrl?: string | null;
};

/**
 * Checks whether user has opted into receiving notifications for this category.
 */
async function isNotificationPermitted(
  prismaClient: PrismaClient,
  userId: string,
  type: NotificationType,
  title: string,
): Promise<{ permitted: boolean; pushEnabled: boolean }> {
  const pref = await prismaClient.notificationPreference.findUnique({
    where: { userId },
  });

  if (!pref) {
    // Default preferences: all critical enabled, marketing disabled, push enabled
    if (type === 'PROMOTION') return { permitted: false, pushEnabled: true };
    return { permitted: true, pushEnabled: true };
  }

  if (type === 'BOOKING') {
    if (title.toLowerCase().includes('reminder')) {
      return { permitted: pref.reminders, pushEnabled: pref.pushEnabled };
    }
    return { permitted: pref.bookingUpdates, pushEnabled: pref.pushEnabled };
  }

  if (type === 'PAYMENT') {
    return { permitted: pref.paymentAlerts, pushEnabled: pref.pushEnabled };
  }

  if (type === 'PROMOTION') {
    return { permitted: pref.marketing, pushEnabled: pref.pushEnabled };
  }

  if (type === 'SYSTEM') {
    if (title.toLowerCase().includes('payout')) {
      return { permitted: pref.payoutAlerts, pushEnabled: pref.pushEnabled };
    }
    return { permitted: true, pushEnabled: pref.pushEnabled };
  }

  return { permitted: true, pushEnabled: pref.pushEnabled };
}

/**
 * Dispatches push notification to active registered devices for a user using Expo Push Service.
 * Resilient: never throws or fails callers if push delivery encounters issues or invalid tokens.
 * Automatically deactivates unregistered tokens (DeviceNotRegistered).
 */
export async function dispatchPushNotifications(
  prismaClient: PrismaClient,
  userId: string,
  title: string,
  message: string,
  actionUrl?: string | null,
  expoClient: Expo = defaultExpoClient,
): Promise<{ sentCount: number; deactivatedCount: number; errorsCount: number }> {
  try {
    const devices = await prismaClient.pushDevice.findMany({
      where: { userId, isActive: true },
      select: { id: true, pushToken: true, deviceType: true },
    });

    if (devices.length === 0) {
      return { sentCount: 0, deactivatedCount: 0, errorsCount: 0 };
    }

    const messages: ExpoPushMessage[] = [];
    const validDeviceMap = new Map<string, string>();

    for (const device of devices) {
      const tokenStr: string = device.pushToken;
      const isValidExpoToken = Expo.isExpoPushToken(tokenStr);

      if (!isValidExpoToken) {
        if (
          (tokenStr as string).startsWith('ExponentPushToken') ||
          (tokenStr as string).startsWith('ExpoPushToken')
        ) {
          await prismaClient.pushDevice.update({
            where: { id: device.id },
            data: { isActive: false },
          });
        }
        continue;
      }

      validDeviceMap.set(tokenStr, device.id);
      messages.push({
        to: tokenStr,
        sound: 'default',
        title,
        body: message,
        data: actionUrl ? { actionUrl } : {},
      });
    }

    if (messages.length === 0) {
      return { sentCount: 0, deactivatedCount: 0, errorsCount: 0 };
    }

    const chunks =
      typeof expoClient.chunkPushNotifications === 'function'
        ? expoClient.chunkPushNotifications(messages)
        : [messages];
    let sentCount = 0;
    let deactivatedCount = 0;
    let errorsCount = 0;

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expoClient.sendPushNotificationsAsync(chunk);
        for (let i = 0; i < ticketChunk.length; i++) {
          const ticket = ticketChunk[i];
          const token = (chunk[i] as ExpoPushMessage).to as string;
          const deviceId = validDeviceMap.get(token);

          if (ticket.status === 'ok') {
            sentCount++;
          } else if (ticket.status === 'error') {
            errorsCount++;
            if (ticket.details?.error === 'DeviceNotRegistered' && deviceId) {
              await prismaClient.pushDevice.update({
                where: { id: deviceId },
                data: { isActive: false },
              });
              deactivatedCount++;
            }
          }
        }
      } catch (chunkError) {
        errorsCount += chunk.length;
        if (process.env.NODE_ENV !== 'test') {
          console.warn('[ExpoPush] Error dispatching push notification chunk:', chunkError);
        }
      }
    }

    return { sentCount, deactivatedCount, errorsCount };
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[ExpoPush] Push notification dispatch failed gracefully:', error);
    }
    return { sentCount: 0, deactivatedCount: 0, errorsCount: 1 };
  }
}

/**
 * Creates an authoritative notification record with preference checking and idempotency deduplication.
 */
export async function createNotification(input: CreateNotificationInput) {
  const prisma = getPrismaClient();

  // 1. Preference check
  const { permitted, pushEnabled } = await isNotificationPermitted(
    prisma,
    input.userId,
    input.type,
    input.title,
  );

  if (!permitted) {
    return null; // Suppressed by user preference
  }

  // 2. Deduplication check
  if (input.dedupKey) {
    const existing = await prisma.notification.findUnique({
      where: { dedupKey: input.dedupKey },
    });
    if (existing) {
      return existing; // Return existing without creating duplicate
    }
  }

  try {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type,
        dedupKey: input.dedupKey || null,
        actionUrl: input.actionUrl || null,
        data: input.data || undefined,
      },
    });

    // 3. Trigger push delivery asynchronously if enabled
    if (pushEnabled) {
      void dispatchPushNotifications(
        prisma,
        input.userId,
        input.title,
        input.message,
        input.actionUrl,
      );
    }

    return notification;
  } catch (error: unknown) {
    // Race condition catch: unique constraint P2002 on dedupKey
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      input.dedupKey
    ) {
      const existing = await prisma.notification.findUnique({
        where: { dedupKey: input.dedupKey },
      });
      if (existing) return existing;
    }
    throw error;
  }
}

/**
 * Non-blocking, fail-safe wrapper around createNotification.
 * Guarantees that notification failures never disrupt critical booking, payment, or payout transactions.
 */
export async function safeNotify(input: CreateNotificationInput): Promise<void> {
  try {
    await createNotification(input);
  } catch {
    // Resilient fallback: log and continue without propagating error
  }
}

/**
 * Retrieves paginated list of notifications for the authenticated user.
 */
export async function getUserNotifications(userId: string, query: NotificationListQuery) {
  const prisma = getPrismaClient();

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const whereCondition: Prisma.NotificationWhereInput = {
    userId,
    ...(query.unreadOnly ? { isRead: false } : {}),
    ...(query.type ? { type: query.type } : {}),
  };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: whereCondition,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: whereCondition }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return {
    items: items.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: n.isRead,
      readAt: n.readAt,
      dedupKey: n.dedupKey,
      actionUrl: n.actionUrl,
      data: n.data,
      createdAt: n.createdAt,
    })),
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/**
 * Retrieves current unread notification count for badge rendering.
 */
export async function getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
  const prisma = getPrismaClient();
  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false },
  });
  return { unreadCount };
}

/**
 * Marks a single notification as read with ownership validation.
 */
export async function markNotificationAsRead(userId: string, notificationId: string) {
  const prisma = getPrismaClient();

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  if (notification.userId !== userId) {
    throw new ApiError(403, 'You do not have permission to access this notification');
  }

  if (notification.isRead) {
    return notification;
  }

  return await prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

/**
 * Marks all unread notifications for a user as read in bulk.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<{ updatedCount: number }> {
  const prisma = getPrismaClient();

  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return { updatedCount: result.count };
}

/**
 * Deletes / dismisses a single notification with ownership validation.
 */
export async function deleteNotification(userId: string, notificationId: string) {
  const prisma = getPrismaClient();

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  if (notification.userId !== userId) {
    throw new ApiError(403, 'You do not have permission to access this notification');
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  return { success: true, message: 'Notification dismissed successfully' };
}

/**
 * Retrieves user's notification preferences, providing safe defaults if not yet customized.
 */
export async function getUserPreferences(userId: string) {
  const prisma = getPrismaClient();

  let pref = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  if (!pref) {
    pref = await prisma.notificationPreference.create({
      data: {
        userId,
        bookingUpdates: true,
        paymentAlerts: true,
        payoutAlerts: true,
        reminders: true,
        marketing: false,
        pushEnabled: true,
        emailEnabled: true,
      },
    });
  }

  return {
    bookingUpdates: pref.bookingUpdates,
    paymentAlerts: pref.paymentAlerts,
    payoutAlerts: pref.payoutAlerts,
    reminders: pref.reminders,
    marketing: pref.marketing,
    pushEnabled: pref.pushEnabled,
    emailEnabled: pref.emailEnabled,
    updatedAt: pref.updatedAt,
  };
}

/**
 * Updates user's notification preferences.
 */
export async function updateUserPreferences(userId: string, input: NotificationPreferencesInput) {
  const prisma = getPrismaClient();

  const updated = await prisma.notificationPreference.upsert({
    where: { userId },
    update: {
      ...(typeof input.bookingUpdates === 'boolean' ? { bookingUpdates: input.bookingUpdates } : {}),
      ...(typeof input.paymentAlerts === 'boolean' ? { paymentAlerts: input.paymentAlerts } : {}),
      ...(typeof input.payoutAlerts === 'boolean' ? { payoutAlerts: input.payoutAlerts } : {}),
      ...(typeof input.reminders === 'boolean' ? { reminders: input.reminders } : {}),
      ...(typeof input.marketing === 'boolean' ? { marketing: input.marketing } : {}),
      ...(typeof input.pushEnabled === 'boolean' ? { pushEnabled: input.pushEnabled } : {}),
      ...(typeof input.emailEnabled === 'boolean' ? { emailEnabled: input.emailEnabled } : {}),
    },
    create: {
      userId,
      bookingUpdates: input.bookingUpdates ?? true,
      paymentAlerts: input.paymentAlerts ?? true,
      payoutAlerts: input.payoutAlerts ?? true,
      reminders: input.reminders ?? true,
      marketing: input.marketing ?? false,
      pushEnabled: input.pushEnabled ?? true,
      emailEnabled: input.emailEnabled ?? true,
    },
  });

  return {
    bookingUpdates: updated.bookingUpdates,
    paymentAlerts: updated.paymentAlerts,
    payoutAlerts: updated.payoutAlerts,
    reminders: updated.reminders,
    marketing: updated.marketing,
    pushEnabled: updated.pushEnabled,
    emailEnabled: updated.emailEnabled,
    updatedAt: updated.updatedAt,
  };
}

/**
 * Registers an active push device token for a user.
 */
export async function registerPushDevice(userId: string, input: RegisterPushDeviceInput) {
  const prisma = getPrismaClient();

  const device = await prisma.pushDevice.upsert({
    where: { pushToken: input.pushToken },
    update: {
      userId,
      deviceType: input.deviceType || null,
      isActive: true,
    },
    create: {
      userId,
      pushToken: input.pushToken,
      deviceType: input.deviceType || null,
      isActive: true,
    },
  });

  return {
    id: device.id,
    pushToken: device.pushToken,
    deviceType: device.deviceType,
    isActive: device.isActive,
  };
}

/**
 * Unregisters a push device token (e.g. upon user logout).
 */
export async function unregisterPushDevice(userId: string, pushToken: string) {
  const prisma = getPrismaClient();

  const device = await prisma.pushDevice.findUnique({
    where: { pushToken },
  });

  if (!device || device.userId !== userId) {
    return { success: true, message: 'Device token cleared' };
  }

  await prisma.pushDevice.update({
    where: { id: device.id },
    data: { isActive: false },
  });

  return { success: true, message: 'Device token unregistered successfully' };
}

/**
 * Broadcasts an administrative announcement notification to target roles.
 */
export async function broadcastNotification(
  _adminUserId: string,
  input: BroadcastNotificationInput,
) {
  const prisma = getPrismaClient();

  let targetRoleFilter: UserRole | undefined;
  if (input.targetRole === 'CUSTOMER') targetRoleFilter = 'CUSTOMER';
  else if (input.targetRole === 'PARTNER') targetRoleFilter = 'PARTNER';

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(targetRoleFilter ? { role: targetRoleFilter } : {}),
    },
    select: { id: true },
  });

  let dispatchedCount = 0;
  const dedupPrefix = `BROADCAST:${Date.now()}`;

  for (const u of users) {
    await safeNotify({
      userId: u.id,
      title: input.title,
      message: input.message,
      type: 'SYSTEM',
      dedupKey: `${dedupPrefix}:${u.id}`,
      actionUrl: input.actionUrl || null,
    });
    dispatchedCount++;
  }

  return {
    dispatchedCount,
    targetRole: input.targetRole || 'ALL',
  };
}

/**
 * Dependable, idempotent scheduled job to dispatch upcoming stay reminders.
 * Checks for confirmed stays with checkIn tomorrow.
 */
export async function processUpcomingStayReminders(): Promise<{ remindersSent: number }> {
  const prisma = getPrismaClient();
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      bookingStatus: 'CONFIRMED',
      checkIn: { lte: tomorrow, gte: now },
    },
    include: {
      hotel: { select: { name: true } },
    },
  });

  let remindersSent = 0;
  for (const b of bookings) {
    const checkInStr = b.checkIn.toISOString().slice(0, 10);
    const dedupKey = `STAY_REMINDER:${b.id}:${checkInStr}`;
    const sent = await createNotification({
      userId: b.customerId,
      title: 'Upcoming Stay Reminder',
      message: `Your stay at ${b.hotel.name} begins tomorrow (${checkInStr}). We look forward to welcoming you!`,
      type: 'BOOKING',
      dedupKey,
      actionUrl: `/(customer)/booking/${b.id}`,
      data: { bookingId: b.id, checkIn: checkInStr },
    });
    if (sent) remindersSent++;
  }

  return { remindersSent };
}

/**
 * Dependable, idempotent scheduled job to dispatch review reminders for concluded stays.
 * Checks for completed stays without submitted reviews.
 */
export async function processCompletedStayReviewReminders(): Promise<{ remindersSent: number }> {
  const prisma = getPrismaClient();
  const now = new Date();
  const past48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      bookingStatus: 'COMPLETED',
      checkOut: { lte: now, gte: past48h },
      review: null, // No review submitted yet
    },
    include: {
      hotel: { select: { name: true } },
    },
  });

  let remindersSent = 0;
  for (const b of bookings) {
    const dedupKey = `REVIEW_REMINDER:${b.id}`;
    const sent = await createNotification({
      userId: b.customerId,
      title: 'Rate Your Recent Stay ⭐',
      message: `How was your visit to ${b.hotel.name}? Share your review to help fellow travelers!`,
      type: 'PROMOTION',
      dedupKey,
      actionUrl: `/(customer)/booking/${b.id}`,
      data: { bookingId: b.id },
    });
    if (sent) remindersSent++;
  }

  return { remindersSent };
}
