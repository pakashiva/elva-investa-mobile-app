import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FilterChips from '../../components/FilterChips';
import InvestmentCard from '../../components/InvestmentCard';
import InvestSectionSwitch from '../../components/InvestSectionSwitch';
import ProfileAvatar from '../../components/ProfileAvatar';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationBell } from '../../hooks/useNotificationBell';
import {
  INVESTMENT_FILTERS,
  filterInvestments,
} from '../../data/investments';
import { getUserInvestments } from '../../services/investmentService';
import { isMissingTableError } from '../../utils/supabaseErrors';
import { Investment, InvestmentFilter } from '../../types/investment';
import { AddFundsStackParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme/colors';
import { DEFAULT_PROFILE_AVATAR } from '../../constants/brandAssets';

const avatarSource = DEFAULT_PROFILE_AVATAR;

type MyInvestmentsNav = NativeStackNavigationProp<
  AddFundsStackParamList,
  'MyInvestments'
>;

export default function MyInvestmentsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<MyInvestmentsNav>();
  const { session } = useAuth();
  const { hasUnread, openNotifications } = useNotificationBell();
  const [filter, setFilter] = useState<InvestmentFilter>('All');
  const [userInvestments, setUserInvestments] = useState<Investment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadUserInvestments = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) {
      setUserInvestments([]);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const investments = await getUserInvestments(userId);
      setUserInvestments(investments);
    } catch (error) {
      if (isMissingTableError(error)) {
        setUserInvestments([]);
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Failed to load investments.';
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadUserInvestments();
    }, [loadUserInvestments])
  );

  const investments = useMemo(
    () => filterInvestments(userInvestments, filter),
    [filter, userInvestments]
  );

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <FlatList
        data={investments}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.headerTextWrap}>
                <Text style={styles.title}>My Investments</Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  View and manage your investments
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

                <TouchableOpacity
                  style={styles.addBtn}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('NewFundRequest')}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.addBtnText}>Add New</Text>
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

            <InvestSectionSwitch active="investments" onInvestments={() => navigation.navigate('MyInvestments')} onWithdrawals={() => navigation.navigate('WithdrawalsList')} />

            <View style={styles.filters}>
              <FilterChips
                filters={INVESTMENT_FILTERS}
                active={filter}
                onChange={setFilter}
              />
            </View>

            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primarySoft} />
              </View>
            ) : null}

            {loadError ? (
              <Text style={styles.errorText}>{loadError}</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <InvestmentCard
            investment={item}
            onPress={() =>
              navigation.navigate('InvestmentDetails', {
                investmentId: item.id,
              })
            }
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {userInvestments.length === 0
                  ? 'No investments yet. Tap Add New to submit a fund request.'
                  : 'No investments in this filter.'}
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
    marginBottom: 16,
    gap: 8,
  },
  headerTextWrap: {
    flexShrink: 1,
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
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
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
    flexShrink: 0,
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
  filters: {
    marginBottom: 14,
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
  },
});
