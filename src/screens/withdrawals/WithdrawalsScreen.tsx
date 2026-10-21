import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WithdrawalCard from '../../components/WithdrawalCard';
import InvestSectionSwitch from '../../components/InvestSectionSwitch';
import ProfileAvatar from '../../components/ProfileAvatar';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationBell } from '../../hooks/useNotificationBell';
import {
  cancelWithdrawalRequest,
  getUserWithdrawals,
} from '../../services/withdrawalService';
import { isMissingTableError } from '../../utils/supabaseErrors';
import { WithdrawalRequest } from '../../types/withdrawal';
import { AddFundsStackParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme/colors';
import { DEFAULT_PROFILE_AVATAR } from '../../constants/brandAssets';

const avatarSource = DEFAULT_PROFILE_AVATAR;

type Nav = NativeStackNavigationProp<
  AddFundsStackParamList,
  'WithdrawalsList'
>;

export default function WithdrawalsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const { hasUnread, openNotifications } = useNotificationBell();
  const [userWithdrawals, setUserWithdrawals] = useState<WithdrawalRequest[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadUserWithdrawals = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) {
      setUserWithdrawals([]);
      setSelectedId(null);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const withdrawals = await getUserWithdrawals(userId);
      setUserWithdrawals(withdrawals);
      setSelectedId((current) =>
        current && withdrawals.some((item) => item.id === current)
          ? current
          : null
      );
    } catch (error) {
      if (isMissingTableError(error)) {
        setUserWithdrawals([]);
        setSelectedId(null);
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Failed to load withdrawals.';
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadUserWithdrawals();
    }, [loadUserWithdrawals])
  );

  const handleCardPress = (item: WithdrawalRequest) => {
    if (item.status !== 'Processing') {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => (current === item.id ? null : item.id));
  };

  const handleCancelPress = (item: WithdrawalRequest) => {
    const userId = session?.user?.id;
    if (!userId || cancellingId) {
      return;
    }

    Alert.alert(
      'Cancel withdraw request?',
      'This will permanently remove the Processing request. You can create a new one later.',
      [
        { text: 'Keep request', style: 'cancel' },
        {
          text: 'Cancel request',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setCancellingId(item.id);
              try {
                await cancelWithdrawalRequest(userId, item.id);
                setUserWithdrawals((prev) =>
                  prev.filter((row) => row.id !== item.id)
                );
                setSelectedId(null);
              } catch (error) {
                const message =
                  error instanceof Error
                    ? error.message
                    : 'Unable to cancel this request right now.';
                Alert.alert('Cancel failed', message);
                try {
                  await loadUserWithdrawals();
                } catch {
                  // List refresh is best-effort after a failed cancel.
                }
              } finally {
                setCancellingId(null);
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <FlatList
        data={userWithdrawals}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.headerTextWrap}>
                <Text style={styles.title}>Withdrawals</Text>
                <Text style={styles.subtitle}>
                  View and manage your payout requests
                </Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.bellBtn}
                  activeOpacity={0.7}
                  onPress={openNotifications}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={20}
                    color={colors.textPrimary}
                  />
                  {hasUnread ? <View style={styles.notifBadge} /> : null}
                </TouchableOpacity>
                <ProfileAvatar
                  source={avatarSource}
                  size={36}
                  showChevron
                  onPress={() =>
                    navigation.getParent()?.navigate('More', {
                      screen: 'MyProfile',
                    })
                  }
                />
              </View>
            </View>

            <InvestSectionSwitch active="withdrawals" onInvestments={() => navigation.navigate('MyInvestments')} onWithdrawals={() => navigation.navigate('WithdrawalsList')} />

            <TouchableOpacity
              style={styles.newBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('CreateWithdrawalRequest')}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.newBtnText}>New Request</Text>
            </TouchableOpacity>

            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}
            {loadError ? (
              <Text style={styles.errorText}>{loadError}</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <WithdrawalCard
            withdrawal={item}
            selected={selectedId === item.id}
            onPress={() => handleCardPress(item)}
            onCancelPress={
              item.status === 'Processing'
                ? () => handleCancelPress(item)
                : undefined
            }
            isCancelling={cancellingId === item.id}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No withdrawal requests yet. Tap New Request to create one.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 14,
    gap: 8,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  newBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    marginBottom: 16,
  },
  newBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    marginBottom: 8,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
