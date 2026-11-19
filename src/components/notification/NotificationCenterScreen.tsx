import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal as RNModal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorView } from '@/components/common/ErrorView';
import { IconButton } from '@/components/common/IconButton';
import { Loader } from '@/components/common/Loader';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import {
  deleteNotification,
  getNotificationPreferences,
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  updateNotificationPreferences,
} from '@/services/api/notificationApi';
import { useAuthStore } from '@/store/authStore';
import type {
  Notification,
  NotificationPreferences,
  NotificationType,
} from '@/types/notification';

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateString;
  }
}

function getTypeIcon(type: NotificationType): string {
  switch (type) {
    case 'BOOKING':
      return '🏨';
    case 'PAYMENT':
      return '💳';
    case 'PROMOTION':
      return '🎁';
    case 'SYSTEM':
      return '⚙️';
    default:
      return '🔔';
  }
}

import type { BadgeTone } from '@/components/common/Badge';

function getTypeTone(type: NotificationType): BadgeTone {
  switch (type) {
    case 'BOOKING':
      return 'primary';
    case 'PAYMENT':
      return 'success';
    case 'PROMOTION':
      return 'gold';
    case 'SYSTEM':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function NotificationCenterScreen({ backPath }: { backPath?: string }) {
  const userRole = useAuthStore((state) => state.user?.role);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preferences modal
  const [preferencesVisible, setPreferencesVisible] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setError(null);
      const res = await getNotifications({
        unreadOnly: filter === 'UNREAD' ? true : undefined,
        limit: 50,
      });
      setNotifications(res.items);
      setUnreadCount(res.unreadCount);
    } catch (err: any) {
      setError(err?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
    }, [loadNotifications]),
  );

  useEffect(() => {
    setLoading(true);
    void loadNotifications();
  }, [loadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadNotifications();
  };

  const handleMarkAsRead = async (item: Notification) => {
    if (!item.isRead) {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      try {
        await markNotificationAsRead(item.id);
      } catch {
        // Quiet failure on read marker
      }
    }

    if (item.actionUrl) {
      try {
        router.push(item.actionUrl as any);
      } catch {
        // Fallback if actionUrl is not directly resolvable
      }
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })),
    );
    setUnreadCount(0);

    try {
      await markAllNotificationsAsRead();
    } catch {
      void loadNotifications();
    }
  };

  const handleDelete = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (target && !target.isRead) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    try {
      await deleteNotification(id);
    } catch {
      void loadNotifications();
    }
  };

  const openPreferences = async () => {
    setPreferencesVisible(true);
    setPrefsLoading(true);
    try {
      const data = await getNotificationPreferences();
      setPrefs(data);
    } catch {
      // Load fallback defaults
      setPrefs({
        bookingUpdates: true,
        paymentAlerts: true,
        payoutAlerts: true,
        reminders: true,
        marketing: false,
        pushEnabled: true,
        emailEnabled: true,
      });
    } finally {
      setPrefsLoading(false);
    }
  };

  const togglePref = async (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    const updatedVal = !prefs[key];
    const newPrefs = { ...prefs, [key]: updatedVal };
    setPrefs(newPrefs);
    setPrefsSaving(true);
    try {
      await updateNotificationPreferences({ [key]: updatedVal });
    } catch {
      // Revert if error
      setPrefs(prefs);
    } finally {
      setPrefsSaving(false);
    }
  };

  const handleBack = () => {
    if (backPath) {
      router.replace(backPath as any);
    } else if (router.canGoBack()) {
      router.back();
    } else if (userRole === 'PARTNER') {
      router.replace('/(partner)/dashboard' as any);
    } else {
      router.replace('/(customer)/home' as any);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {/* Top Navigation Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <IconButton
            accessibilityLabel="Go back"
            icon={<Text style={styles.backChevron}>‹</Text>}
            onPress={handleBack}
            size={40}
            variant="surface"
          />
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </Text>
          </View>
        </View>
        <IconButton
          accessibilityLabel="Notification settings"
          icon={<Text style={styles.gearIcon}>⚙️</Text>}
          onPress={() => void openPreferences()}
          size={40}
          variant="surface"
        />
      </View>

      {/* Tabs and Bulk Action Bar */}
      <View style={styles.actionBar}>
        <View style={styles.tabGroup}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === 'ALL' }}
            onPress={() => setFilter('ALL')}
            style={[styles.tab, filter === 'ALL' && styles.tabActive]}>
            <Text style={[styles.tabText, filter === 'ALL' && styles.tabTextActive]}>
              All
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === 'UNREAD' }}
            onPress={() => setFilter('UNREAD')}
            style={[styles.tab, filter === 'UNREAD' && styles.tabActive]}>
            <Text style={[styles.tabText, filter === 'UNREAD' && styles.tabTextActive]}>
              Unread {unreadCount > 0 ? `(${unreadCount})` : ''}
            </Text>
          </Pressable>
        </View>

        {unreadCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleMarkAllRead()}
            style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all as read</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Main Content Area */}
      {loading ? (
        <Loader label="Loading notifications..." />
      ) : error ? (
        <ErrorView message={error} onRetry={() => void loadNotifications()} />
      ) : notifications.length === 0 ? (
        <EmptyState
          title={filter === 'UNREAD' ? 'No unread notifications' : 'No notifications yet'}
          description={
            filter === 'UNREAD'
              ? 'You have read all your notifications.'
              : 'Updates regarding your bookings, payments, and stays will appear here.'
          }
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${item.isRead ? 'read' : 'unread'}`}
              onPress={() => void handleMarkAsRead(item)}
              style={({ pressed }) => [
                styles.card,
                !item.isRead && styles.cardUnread,
                pressed && styles.cardPressed,
              ]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={styles.typeIcon}>{getTypeIcon(item.type)}</Text>
                  <Badge label={item.type} tone={getTypeTone(item.type)} />
                  {!item.isRead ? <View style={styles.unreadDot} /> : null}
                </View>
                <View style={styles.cardHeaderRight}>
                  <Text style={styles.timeText}>{formatRelativeTime(item.createdAt)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss notification"
                    onPress={() => void handleDelete(item.id)}
                    hitSlop={8}
                    style={styles.dismissBtn}>
                    <Text style={styles.dismissIcon}>✕</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={[styles.cardTitle, !item.isRead && styles.cardTitleBold]}>
                {item.title}
              </Text>
              <Text style={styles.cardMessage}>{item.message}</Text>

              {item.actionUrl ? (
                <View style={styles.actionPrompt}>
                  <Text style={styles.actionPromptText}>View details →</Text>
                </View>
              ) : null}
            </Pressable>
          )}
        />
      )}

      {/* Notification Preferences Modal */}
      <RNModal
        visible={preferencesVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPreferencesVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notification Preferences</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPreferencesVisible(false)}
                hitSlop={8}>
                <Text style={styles.modalCloseText}>Done</Text>
              </Pressable>
            </View>

            {prefsLoading || !prefs ? (
              <Loader label="Loading preferences..." />
            ) : (
              <View style={styles.prefList}>
                <PrefToggleRow
                  title="Booking Updates"
                  description="Confirmations, modifications, and status changes"
                  value={prefs.bookingUpdates}
                  onToggle={() => void togglePref('bookingUpdates')}
                  disabled={prefsSaving}
                />
                <PrefToggleRow
                  title="Payment Alerts"
                  description="Receipts, successful charges, and refund notices"
                  value={prefs.paymentAlerts}
                  onToggle={() => void togglePref('paymentAlerts')}
                  disabled={prefsSaving}
                />
                {userRole === 'PARTNER' ? (
                  <PrefToggleRow
                    title="Payout Alerts"
                    description="Payout approvals, processing, and transfer confirmations"
                    value={prefs.payoutAlerts}
                    onToggle={() => void togglePref('payoutAlerts')}
                    disabled={prefsSaving}
                  />
                ) : null}
                <PrefToggleRow
                  title="Stay Reminders"
                  description="Pre-arrival check-in info and post-checkout review prompts"
                  value={prefs.reminders}
                  onToggle={() => void togglePref('reminders')}
                  disabled={prefsSaving}
                />
                <PrefToggleRow
                  title="Exclusive Offers & Deals"
                  description="Discounts, seasonal promotions, and partner deals"
                  value={prefs.marketing}
                  onToggle={() => void togglePref('marketing')}
                  disabled={prefsSaving}
                />
                <PrefToggleRow
                  title="Push Notifications"
                  description="Deliver alerts directly to your device screen"
                  value={prefs.pushEnabled}
                  onToggle={() => void togglePref('pushEnabled')}
                  disabled={prefsSaving}
                />
              </View>
            )}
          </View>
        </View>
      </RNModal>
    </SafeAreaView>
  );
}

function PrefToggleRow({
  title,
  description,
  value,
  onToggle,
  disabled,
}: {
  title: string;
  description: string;
  value: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.prefRow}>
      <View style={styles.prefCopy}>
        <Text style={styles.prefTitle}>{title}</Text>
        <Text style={styles.prefDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: '#E2E8F0', true: colors.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  backChevron: {
    fontSize: 28,
    color: colors.text,
    lineHeight: 30,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
  gearIcon: {
    fontSize: 18,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabGroup: {
    flexDirection: 'row',
    gap: spacing.xsmall,
  },
  tab: {
    paddingHorizontal: spacing.medium,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.surface,
    fontWeight: '700',
  },
  markAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  markAllText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.medium,
    gap: spacing.small,
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.medium,
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  cardUnread: {
    borderColor: '#93C5FD',
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeIcon: {
    fontSize: 14,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  timeText: {
    color: colors.muted,
    fontSize: 11,
  },
  dismissBtn: {
    padding: 2,
  },
  dismissIcon: {
    color: colors.muted,
    fontSize: 12,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  cardTitleBold: {
    fontWeight: '800',
  },
  cardMessage: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  actionPrompt: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  actionPromptText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.large,
    borderTopRightRadius: radii.large,
    padding: spacing.large,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.medium,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalCloseText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  prefList: {
    gap: spacing.medium,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xsmall,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  prefCopy: {
    flex: 1,
    paddingRight: spacing.medium,
    gap: 2,
  },
  prefTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  prefDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
});
