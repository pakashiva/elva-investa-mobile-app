import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { getWithdrawalByIdForUser } from '../../services/withdrawalService';
import { WithdrawalRequest } from '../../types/withdrawal';
import { AddFundsStackScreenProps } from '../../navigation/types';
import { colors, spacing } from '../../theme/colors';

type Props = AddFundsStackScreenProps<'WithdrawalDetails'>;

export default function WithdrawalDetailsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [withdrawal, setWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadWithdrawal = useCallback(async () => {
    const userId = session?.user?.id;
    const withdrawalId = route.params.withdrawalId;

    setIsLoading(true);
    setLoadError(null);

    if (!userId) {
      setWithdrawal(null);
      setLoadError('Please sign in to view withdrawal details.');
      setIsLoading(false);
      return;
    }

    try {
      const item = await getWithdrawalByIdForUser(userId, withdrawalId);
      setWithdrawal(item);
      if (!item) {
        setLoadError('Withdrawal request not found.');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load withdrawal.';
      setLoadError(message);
      setWithdrawal(null);
    } finally {
      setIsLoading(false);
    }
  }, [route.params.withdrawalId, session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadWithdrawal();
    }, [loadWithdrawal])
  );

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Withdrawal Details</Text>
      </View>
      <View style={styles.body}>
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : null}

        {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

        {withdrawal ? (
          <>
            <Text style={styles.code}>{withdrawal.investmentCode}</Text>
            <Text style={styles.name}>{withdrawal.fundName}</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Status</Text>
              <Text style={styles.value}>{withdrawal.status}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Requested</Text>
              <Text style={styles.value}>{withdrawal.requestedAmount}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Net payout</Text>
              <Text style={styles.value}>{withdrawal.netPayout}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Requested on</Text>
              <Text style={styles.value}>{withdrawal.requestedOn}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{withdrawal.statusDateLabel}</Text>
              <Text style={styles.value}>{withdrawal.statusDate}</Text>
            </View>
          </>
        ) : null}
      </View>
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
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: {
    paddingHorizontal: spacing.screen,
    paddingTop: 20,
  },
  code: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    marginBottom: 12,
  },
});
