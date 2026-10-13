import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import {
  getInvestorNotifications,
  InvestorNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notificationService';
import { isMissingTableError } from '../../utils/supabaseErrors';
import { RootStackScreenProps } from '../../navigation/types';
import { colors, spacing } from '../../theme/colors';

type Props = RootStackScreenProps<'Notifications'>;

function formatNotificationTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function kindLabel(kind: InvestorNotification['kind']): string {
  if (kind === 'withdrawal') return 'Withdrawal';
  if (kind === 'agreement_renewal') return 'Renewal';
  if (kind === 'loan') return 'Loan';
  return 'Investment';
}

function NotificationIcon({ item }: { item: InvestorNotification }) {
  const approved = item.decision !== 'rejected';
  const iconName =
    item.kind === 'withdrawal'
      ? approved
        ? 'arrow-up-circle'
        : 'close-circle'
      : item.kind === 'agreement_renewal'
        ? approved
          ? 'refresh-circle'
          : 'close-circle'
        : item.kind === 'loan' ? approved ? 'business' : 'close-circle' : approved
          ? 'checkmark-circle'
          : 'close-circle';

  return (
    <View
      style={[
        styles.iconWrap,
        { backgroundColor: approved ? colors.successBg : '#FDECEC' },
      ]}
    >
      <Ionicons
        name={iconName}
        size={22}
        color={approved ? colors.success : colors.danger}
      />
    </View>
  );
}

export default function NotificationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [items, setItems] = useState<InvestorNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await getInvestorNotifications(userId);
      setItems(data);
      const hasUnread = data.some((n) => !n.isRead);
      if (hasUnread) {
        await markAllNotificationsRead(userId);
        setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch (err) {
      if (isMissingTableError(err)) {
        setItems([]);
        return;
      }
      setError(
        err instanceof Error ? err.message : 'Failed to load notifications.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onPressItem = async (item: InvestorNotification) => {
    const userId = session?.user?.id;
    if (!userId || item.isRead) return;
    try {
      await markNotificationRead(userId, item.id);
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
    } catch {
      // non-blocking
    }
  };

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            Approvals and rejections for fund & withdrawal requests
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primarySoft} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            error ? <Text style={styles.errorText}>{error}</Text> : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="notifications-outline"
                  size={28}
                  color={colors.textMuted}
                />
              </View>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyBody}>
                You will see updates here when an investment or withdrawal
                request is approved or rejected.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, !item.isRead && styles.cardUnread]}
              activeOpacity={0.75}
              onPress={() => onPressItem(item)}
            >
              <NotificationIcon item={item} />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View
                    style={[
                      styles.kindChip,
                      item.kind === 'withdrawal'
                        ? styles.kindChipWithdrawal
                        : item.kind === 'agreement_renewal'
                          ? styles.kindChipRenewal
                          : item.kind === 'loan' ? styles.kindChipRenewal : styles.kindChipInvestment,
                    ]}
                  >
                    <Text style={styles.kindChipText}>
                      {kindLabel(item.kind)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardBodyText}>{item.body}</Text>
                <Text style={styles.cardTime}>
                  {formatNotificationTime(item.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.screen,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    paddingTop: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  headerSpacer: {
    width: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 24,
    flexGrow: 1,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: 12,
  },
  emptyWrap: {
    marginTop: 64,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  cardUnread: {
    borderColor: '#D9CEFF',
    backgroundColor: '#FBF9FF',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  kindChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  kindChipInvestment: {
    backgroundColor: '#EDE7FF',
  },
  kindChipWithdrawal: {
    backgroundColor: '#EEF0F3',
  },
  kindChipRenewal: {
    backgroundColor: '#E8ECF8',
  },
  kindChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cardBodyText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  cardTime: {
    marginTop: 8,
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
