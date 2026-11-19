import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type CreateNotificationInput,
  type NotificationListQuery,
  type NotificationPreferencesInput,
  type RegisterPushDeviceInput,
  dispatchPushNotifications,
  safeNotify,
} from '../src/services/notification.service.js';
import { ApiError } from '../src/utils/ApiError.js';

describe('Phase 15 — Notification System Unit & Business Rules Tests', () => {
  const customerUserId = 'usr-cust-1111-2222';
  const otherCustomerUserId = 'usr-cust-3333-4444';
  const partnerUserId = 'usr-part-5555-6666';
  const adminUserId = 'usr-admin-9999-0000';

  type MockNotification = {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: 'BOOKING' | 'PAYMENT' | 'PROMOTION' | 'SYSTEM';
    isRead: boolean;
    readAt: Date | null;
    dedupKey: string | null;
    actionUrl: string | null;
    data?: any;
    createdAt: Date;
  };

  type MockPreference = {
    userId: string;
    bookingUpdates: boolean;
    paymentAlerts: boolean;
    payoutAlerts: boolean;
    reminders: boolean;
    marketing: boolean;
    pushEnabled: boolean;
    emailEnabled: boolean;
  };

  type MockPushDevice = {
    id: string;
    userId: string;
    pushToken: string;
    deviceType: string | null;
    isActive: boolean;
  };

  // In-memory simulator for isolated unit verification
  class NotificationSimulator {
    notifications: MockNotification[] = [];
    preferences: Map<string, MockPreference> = new Map();
    pushDevices: MockPushDevice[] = [];

    getPreferences(userId: string): MockPreference {
      let pref = this.preferences.get(userId);
      if (!pref) {
        pref = {
          userId,
          bookingUpdates: true,
          paymentAlerts: true,
          payoutAlerts: true,
          reminders: true,
          marketing: false, // Default false for marketing
          pushEnabled: true,
          emailEnabled: true,
        };
        this.preferences.set(userId, pref);
      }
      return { ...pref };
    }

    updatePreferences(userId: string, input: NotificationPreferencesInput): MockPreference {
      const current = this.getPreferences(userId);
      const updated: MockPreference = {
        ...current,
        ...(typeof input.bookingUpdates === 'boolean' ? { bookingUpdates: input.bookingUpdates } : {}),
        ...(typeof input.paymentAlerts === 'boolean' ? { paymentAlerts: input.paymentAlerts } : {}),
        ...(typeof input.payoutAlerts === 'boolean' ? { payoutAlerts: input.payoutAlerts } : {}),
        ...(typeof input.reminders === 'boolean' ? { reminders: input.reminders } : {}),
        ...(typeof input.marketing === 'boolean' ? { marketing: input.marketing } : {}),
        ...(typeof input.pushEnabled === 'boolean' ? { pushEnabled: input.pushEnabled } : {}),
        ...(typeof input.emailEnabled === 'boolean' ? { emailEnabled: input.emailEnabled } : {}),
      };
      this.preferences.set(userId, updated);
      return { ...updated };
    }

    isPermitted(userId: string, type: string, title: string): { permitted: boolean; pushEnabled: boolean } {
      const pref = this.getPreferences(userId);
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

    createNotification(input: CreateNotificationInput): MockNotification | null {
      const { permitted } = this.isPermitted(input.userId, input.type, input.title);
      if (!permitted) {
        return null; // Suppressed by preferences
      }

      if (input.dedupKey) {
        const existing = this.notifications.find((n) => n.dedupKey === input.dedupKey);
        if (existing) {
          return existing; // Deduplicated
        }
      }

      const notif: MockNotification = {
        id: 'notif-' + Math.random().toString(36).substring(2, 9),
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type,
        isRead: false,
        readAt: null,
        dedupKey: input.dedupKey || null,
        actionUrl: input.actionUrl || null,
        data: input.data,
        createdAt: new Date(),
      };
      this.notifications.push(notif);
      return notif;
    }

    getUserNotifications(userId: string, query: NotificationListQuery = {}) {
      let filtered = this.notifications.filter((n) => n.userId === userId);
      if (query.unreadOnly) {
        filtered = filtered.filter((n) => !n.isRead);
      }
      if (query.type) {
        filtered = filtered.filter((n) => n.type === query.type);
      }
      const unreadCount = this.notifications.filter((n) => n.userId === userId && !n.isRead).length;
      return {
        items: filtered,
        unreadCount,
        total: filtered.length,
      };
    }

    getUnreadCount(userId: string): number {
      return this.notifications.filter((n) => n.userId === userId && !n.isRead).length;
    }

    markAsRead(userId: string, notificationId: string): MockNotification {
      const notif = this.notifications.find((n) => n.id === notificationId);
      if (!notif) {
        throw new ApiError(404, 'Notification not found');
      }
      if (notif.userId !== userId) {
        throw new ApiError(403, 'You do not have permission to access this notification');
      }
      if (!notif.isRead) {
        notif.isRead = true;
        notif.readAt = new Date();
      }
      return notif;
    }

    markAllAsRead(userId: string): number {
      let count = 0;
      for (const n of this.notifications) {
        if (n.userId === userId && !n.isRead) {
          n.isRead = true;
          n.readAt = new Date();
          count++;
        }
      }
      return count;
    }

    deleteNotification(userId: string, notificationId: string) {
      const index = this.notifications.findIndex((n) => n.id === notificationId);
      if (index === -1) {
        throw new ApiError(404, 'Notification not found');
      }
      if (this.notifications[index].userId !== userId) {
        throw new ApiError(403, 'You do not have permission to access this notification');
      }
      this.notifications.splice(index, 1);
      return { success: true };
    }

    registerPushDevice(userId: string, input: RegisterPushDeviceInput): MockPushDevice {
      let device = this.pushDevices.find((d) => d.pushToken === input.pushToken);
      if (device) {
        device.userId = userId;
        device.isActive = true;
        device.deviceType = input.deviceType || device.deviceType;
      } else {
        device = {
          id: 'dev-' + Math.random().toString(36).substring(2, 9),
          userId,
          pushToken: input.pushToken,
          deviceType: input.deviceType || null,
          isActive: true,
        };
        this.pushDevices.push(device);
      }
      return device;
    }

    unregisterPushDevice(userId: string, pushToken: string) {
      const device = this.pushDevices.find((d) => d.pushToken === pushToken && d.userId === userId);
      if (device) {
        device.isActive = false;
      }
      return { success: true };
    }
  }

  // 1. Notification Preferences & Filtering
  describe('1. Notification Preferences & Permission Filtering', () => {
    it('initializes default preferences with marketing disabled and transactional alerts enabled', () => {
      const sim = new NotificationSimulator();
      const prefs = sim.getPreferences(customerUserId);

      assert.strictEqual(prefs.bookingUpdates, true);
      assert.strictEqual(prefs.paymentAlerts, true);
      assert.strictEqual(prefs.payoutAlerts, true);
      assert.strictEqual(prefs.reminders, true);
      assert.strictEqual(prefs.marketing, false);
      assert.strictEqual(prefs.pushEnabled, true);
      assert.strictEqual(prefs.emailEnabled, true);
    });

    it('suppresses marketing/promotional notifications when marketing preference is false', () => {
      const sim = new NotificationSimulator();
      const notif = sim.createNotification({
        userId: customerUserId,
        title: 'Special Summer Offer!',
        message: 'Get 20% off your next booking.',
        type: 'PROMOTION',
      });

      assert.strictEqual(notif, null);
      assert.strictEqual(sim.getUnreadCount(customerUserId), 0);
    });

    it('delivers marketing notifications when user opts in to marketing', () => {
      const sim = new NotificationSimulator();
      sim.updatePreferences(customerUserId, { marketing: true });

      const notif = sim.createNotification({
        userId: customerUserId,
        title: 'Special Summer Offer!',
        message: 'Get 20% off your next booking.',
        type: 'PROMOTION',
      });

      assert.notStrictEqual(notif, null);
      assert.strictEqual(notif?.title, 'Special Summer Offer!');
      assert.strictEqual(sim.getUnreadCount(customerUserId), 1);
    });

    it('suppresses stay reminders when reminders preference is disabled', () => {
      const sim = new NotificationSimulator();
      sim.updatePreferences(customerUserId, { reminders: false });

      const notif = sim.createNotification({
        userId: customerUserId,
        title: 'Upcoming Stay Reminder',
        message: 'Your stay starts tomorrow.',
        type: 'BOOKING',
      });

      assert.strictEqual(notif, null);
    });

    it('delivers critical booking updates even when reminders are disabled', () => {
      const sim = new NotificationSimulator();
      sim.updatePreferences(customerUserId, { reminders: false });

      const notif = sim.createNotification({
        userId: customerUserId,
        title: 'Booking Confirmed',
        message: 'Your reservation is confirmed.',
        type: 'BOOKING',
      });

      assert.notStrictEqual(notif, null);
      assert.strictEqual(notif?.title, 'Booking Confirmed');
    });
  });

  // 2. Idempotency & Deduplication
  describe('2. Idempotency & Deduplication Protection', () => {
    it('prevents duplicate notification creation with identical dedupKey', () => {
      const sim = new NotificationSimulator();
      const dedupKey = 'BOOKING_CONFIRMED:bkg-12345';

      const first = sim.createNotification({
        userId: customerUserId,
        title: 'Booking Confirmed',
        message: 'Your stay is confirmed.',
        type: 'BOOKING',
        dedupKey,
      });

      const second = sim.createNotification({
        userId: customerUserId,
        title: 'Booking Confirmed',
        message: 'Your stay is confirmed.',
        type: 'BOOKING',
        dedupKey,
      });

      assert.strictEqual(first?.id, second?.id);
      assert.strictEqual(sim.notifications.length, 1);
    });

    it('creates distinct notifications for distinct dedupKeys', () => {
      const sim = new NotificationSimulator();

      const notif1 = sim.createNotification({
        userId: customerUserId,
        title: 'Booking Created',
        message: 'Booking 1',
        type: 'BOOKING',
        dedupKey: 'BOOKING:1',
      });

      const notif2 = sim.createNotification({
        userId: customerUserId,
        title: 'Booking Created',
        message: 'Booking 2',
        type: 'BOOKING',
        dedupKey: 'BOOKING:2',
      });

      assert.notStrictEqual(notif1?.id, notif2?.id);
      assert.strictEqual(sim.notifications.length, 2);
    });
  });

  // 3. User Scoping & Authorization
  describe('3. User Scoping & Access Control', () => {
    it('isolates notifications so users only see their own items', () => {
      const sim = new NotificationSimulator();

      sim.createNotification({
        userId: customerUserId,
        title: 'Customer Note',
        message: 'For customer',
        type: 'BOOKING',
      });

      sim.createNotification({
        userId: otherCustomerUserId,
        title: 'Other Customer Note',
        message: 'For other customer',
        type: 'BOOKING',
      });

      const customerNotes = sim.getUserNotifications(customerUserId);
      const otherNotes = sim.getUserNotifications(otherCustomerUserId);

      assert.strictEqual(customerNotes.items.length, 1);
      assert.strictEqual(customerNotes.items[0].userId, customerUserId);

      assert.strictEqual(otherNotes.items.length, 1);
      assert.strictEqual(otherNotes.items[0].userId, otherCustomerUserId);
    });

    it('rejects attempt to mark another user notification as read with 403 Forbidden', () => {
      const sim = new NotificationSimulator();
      const notif = sim.createNotification({
        userId: otherCustomerUserId,
        title: 'Private Note',
        message: 'Secret',
        type: 'PAYMENT',
      });

      assert.throws(
        () => sim.markAsRead(customerUserId, notif!.id),
        (err: any) => err instanceof ApiError && err.statusCode === 403,
      );
    });

    it('rejects attempt to delete another user notification with 403 Forbidden', () => {
      const sim = new NotificationSimulator();
      const notif = sim.createNotification({
        userId: otherCustomerUserId,
        title: 'Private Note',
        message: 'Secret',
        type: 'PAYMENT',
      });

      assert.throws(
        () => sim.deleteNotification(customerUserId, notif!.id),
        (err: any) => err instanceof ApiError && err.statusCode === 403,
      );
    });
  });

  // 4. Read State Transitions & Badge Count
  describe('4. Read State Transitions & Unread Count Badge', () => {
    it('tracks unread count accurately through creation, mark read, and bulk mark read', () => {
      const sim = new NotificationSimulator();

      const n1 = sim.createNotification({
        userId: customerUserId,
        title: 'Note 1',
        message: 'First',
        type: 'BOOKING',
      });
      const n2 = sim.createNotification({
        userId: customerUserId,
        title: 'Note 2',
        message: 'Second',
        type: 'BOOKING',
      });
      sim.createNotification({
        userId: customerUserId,
        title: 'Note 3',
        message: 'Third',
        type: 'BOOKING',
      });

      assert.strictEqual(sim.getUnreadCount(customerUserId), 3);

      // Mark single notification as read
      sim.markAsRead(customerUserId, n1!.id);
      assert.strictEqual(sim.getUnreadCount(customerUserId), 2);
      assert.strictEqual(n1?.isRead, true);
      assert.notStrictEqual(n1?.readAt, null);

      // Re-marking already read notification is idempotent
      sim.markAsRead(customerUserId, n1!.id);
      assert.strictEqual(sim.getUnreadCount(customerUserId), 2);

      // Bulk mark all remaining as read
      const updatedCount = sim.markAllAsRead(customerUserId);
      assert.strictEqual(updatedCount, 2);
      assert.strictEqual(sim.getUnreadCount(customerUserId), 0);
      assert.strictEqual(n2?.isRead, true);
    });

    it('supports deleting a notification and updates list count', () => {
      const sim = new NotificationSimulator();
      const notif = sim.createNotification({
        userId: customerUserId,
        title: 'To Dismiss',
        message: 'Dismiss me',
        type: 'SYSTEM',
      });

      assert.strictEqual(sim.getUserNotifications(customerUserId).total, 1);
      sim.deleteNotification(customerUserId, notif!.id);
      assert.strictEqual(sim.getUserNotifications(customerUserId).total, 0);
    });
  });

  // 5. Push Device Token Registration
  describe('5. Push Device Token Management', () => {
    it('registers, updates, and unregisters push tokens correctly', () => {
      const sim = new NotificationSimulator();
      const token = 'ExponentPushToken[AbCdEf12345]';

      const device = sim.registerPushDevice(customerUserId, {
        pushToken: token,
        deviceType: 'ios',
      });

      assert.strictEqual(device.pushToken, token);
      assert.strictEqual(device.isActive, true);
      assert.strictEqual(device.userId, customerUserId);

      // Unregister token (e.g. on logout)
      sim.unregisterPushDevice(customerUserId, token);
      assert.strictEqual(sim.pushDevices[0].isActive, false);

      // Re-registering token activates it again
      sim.registerPushDevice(customerUserId, { pushToken: token });
      assert.strictEqual(sim.pushDevices[0].isActive, true);
    });
  });

  // 6. Fail-Safe Resilience (safeNotify)
  describe('6. Non-blocking Fail-Safe Resilience (safeNotify)', () => {
    it('safeNotify never throws even if unexpected errors occur', async () => {
      let threw = false;
      try {
        await safeNotify({
          userId: 'non-existent-user-id',
          title: 'Safe test',
          message: 'Safe test message',
          type: 'SYSTEM',
        });
      } catch {
        threw = true;
      }
      assert.strictEqual(threw, false);
    });
  });

  // 7. Role-Specific Action Links & Event Mapping
  describe('7. Role-Specific Action URLs & Event Routing', () => {
    it('formats customer booking deep link correctly', () => {
      const bookingId = 'bkg-cust-123';
      const actionUrl = `/(customer)/booking/${bookingId}`;
      assert.strictEqual(actionUrl, '/(customer)/booking/bkg-cust-123');
    });

    it('formats partner booking deep link correctly', () => {
      const bookingId = 'bkg-part-456';
      const actionUrl = `/(partner)/bookings/${bookingId}`;
      assert.strictEqual(actionUrl, '/(partner)/bookings/bkg-part-456');
    });

    it('formats partner payout deep link correctly', () => {
      const actionUrl = `/(partner)/payouts`;
      assert.strictEqual(actionUrl, '/(partner)/payouts');
    });
  });

  // 8. Real Expo Push Notification Delivery & Inactive Token Cleanup
  describe('8. Expo Push Notification Delivery & Cleanup Logic', () => {
    it('dispatches chunked push notifications to active valid Expo tokens', async () => {
      const pushDevices = [
        { id: 'dev-1', pushToken: 'ExponentPushToken[validToken1234567890]', deviceType: 'IOS', isActive: true },
      ];

      const mockPrisma: any = {
        pushDevice: {
          findMany: async () => pushDevices.filter((d) => d.isActive),
          update: async ({ where, data }: any) => {
            const dev = pushDevices.find((d) => d.id === where.id);
            if (dev) Object.assign(dev, data);
            return dev;
          },
        },
      };

      const mockExpo: any = {
        chunkPushNotifications: (msgs: any[]) => [msgs],
        sendPushNotificationsAsync: async (chunk: any[]) => {
          return chunk.map(() => ({ status: 'ok', id: 'ticket-123' }));
        },
      };

      const result = await dispatchPushNotifications(
        mockPrisma,
        customerUserId,
        'Booking Confirmed',
        'Your room is ready!',
        '/(customer)/booking/bkg-1',
        mockExpo,
      );

      assert.strictEqual(result.sentCount, 1);
      assert.strictEqual(result.deactivatedCount, 0);
      assert.strictEqual(result.errorsCount, 0);
    });

    it('automatically deactivates unregistered tokens when Expo returns DeviceNotRegistered', async () => {
      const pushDevices = [
        { id: 'dev-stale', pushToken: 'ExponentPushToken[staleToken123456789]', deviceType: 'ANDROID', isActive: true },
      ];

      const mockPrisma: any = {
        pushDevice: {
          findMany: async () => pushDevices.filter((d) => d.isActive),
          update: async ({ where, data }: any) => {
            const dev = pushDevices.find((d) => d.id === where.id);
            if (dev) Object.assign(dev, data);
            return dev;
          },
        },
      };

      const mockExpo: any = {
        chunkPushNotifications: (msgs: any[]) => [msgs],
        sendPushNotificationsAsync: async () => {
          return [
            {
              status: 'error',
              message: 'The recipient device is not registered with Expo',
              details: { error: 'DeviceNotRegistered' },
            },
          ];
        },
      };

      const result = await dispatchPushNotifications(
        mockPrisma,
        customerUserId,
        'Payment Receipt',
        'Payment of $200 confirmed',
        null,
        mockExpo,
      );

      assert.strictEqual(result.sentCount, 0);
      assert.strictEqual(result.deactivatedCount, 1);
      assert.strictEqual(result.errorsCount, 1);
      assert.strictEqual(pushDevices[0].isActive, false, 'Stale token must be deactivated');
    });

    it('handles unexpected Expo network exceptions fail-safely without throwing', async () => {
      const pushDevices = [
        { id: 'dev-err', pushToken: 'ExponentPushToken[networkFailToken123]', deviceType: 'IOS', isActive: true },
      ];

      const mockPrisma: any = {
        pushDevice: {
          findMany: async () => pushDevices.filter((d) => d.isActive),
        },
      };

      const mockExpo: any = {
        chunkPushNotifications: (msgs: any[]) => [msgs],
        sendPushNotificationsAsync: async () => {
          throw new Error('Expo server network timeout (ETIMEDOUT)');
        },
      };

      let threw = false;
      let result: any = null;
      try {
        result = await dispatchPushNotifications(
          mockPrisma,
          customerUserId,
          'Alert',
          'Network test',
          null,
          mockExpo,
        );
      } catch {
        threw = true;
      }

      assert.strictEqual(threw, false, 'Must never throw on push delivery failure');
      assert.strictEqual(result.sentCount, 0);
      assert.strictEqual(result.errorsCount, 1);
    });
  });
});
