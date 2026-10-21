import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FormSelectField from '../../components/form/FormSelectField';
import KeyboardSafeScroll from '../../components/form/KeyboardSafeScroll';
import HistoryRequestTabs from '../../components/withdrawals/HistoryRequestTabs';
import WithdrawalStrategyCards from '../../components/withdrawals/WithdrawalStrategyCards';
import RequestTimelineBar from '../../components/withdrawals/RequestTimelineBar';
import { useAuth } from '../../contexts/AuthContext';
import {
  getUserBankAccounts,
  verifyBankAccountOwnership,
} from '../../services/bankAccountService';
import {
  getActiveInvestmentForUser,
  getActiveInvestmentsForWithdrawal,
} from '../../services/investmentService';
import {
  createWithdrawalRequest,
  getRequestedDateLabel,
} from '../../services/withdrawalService';
import { AddFundsStackScreenProps } from '../../navigation/types';
import { formatInrPlain, parseInrInput } from '../../utils/currency';
import {
  isMissingTableError,
  MISSING_INVESTMENTS_TABLE_MESSAGE,
} from '../../utils/supabaseErrors';
import { validatePartialWithdrawalAmount } from '../../utils/validatePartialWithdrawal';
import { WithdrawalStrategy } from '../../types/withdrawal';
import { colors, spacing } from '../../theme/colors';

type FundOption = {
  id: string;
  label: string;
  principal: number;
  withdrawalAmount: number;
  openPartialAmount: number;
  availablePrincipal: number;
  hasOpenFullWithdrawal: boolean;
};

type Props = AddFundsStackScreenProps<'CreateWithdrawalRequest'>;

export default function CreateWithdrawalRequestScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [fundId, setFundId] = useState<string | null>(null);
  const [bankId, setBankId] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<WithdrawalStrategy>('full');
  const [partialAmountInput, setPartialAmountInput] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [fundOptions, setFundOptions] = useState<FundOption[]>([]);
  const [bankOptions, setBankOptions] = useState<{ id: string; label: string }[]>(
    []
  );
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requestedDate = useMemo(() => getRequestedDateLabel(), []);

  const selectedFund = useMemo(
    () => fundOptions.find((fund) => fund.id === fundId) ?? null,
    [fundId, fundOptions]
  );

  const isPartial = strategy === 'partial';

  const withdrawalAmountDisplay = useMemo(() => {
    if (!selectedFund) {
      return '';
    }
    if (isPartial) {
      return partialAmountInput;
    }
    return formatInrPlain(selectedFund.withdrawalAmount);
  }, [isPartial, partialAmountInput, selectedFund]);

  const partialAmountHint = useMemo(() => {
    if (!selectedFund || !isPartial) {
      return null;
    }
    if (selectedFund.openPartialAmount > 0) {
      return `Open partial requests: ₹${selectedFund.openPartialAmount.toLocaleString('en-IN')}. Available now: ₹${selectedFund.availablePrincipal.toLocaleString('en-IN')}.`;
    }
    return `Withdraw from principal. Max ₹${selectedFund.availablePrincipal.toLocaleString('en-IN')}. Use Full Withdrawal to exit completely.`;
  }, [isPartial, selectedFund]);

  const handleFundChange = (nextFundId: string | null) => {
    setFundId(nextFundId);
    setPartialAmountInput('');
    const fund = fundOptions.find((item) => item.id === nextFundId);
    if (fund && fund.openPartialAmount > 0) {
      setStrategy('partial');
    }
  };

  const handleStrategyChange = (nextStrategy: WithdrawalStrategy) => {
    if (
      nextStrategy === 'partial' &&
      selectedFund &&
      selectedFund.availablePrincipal <= 0
    ) {
      return;
    }
    if (
      nextStrategy === 'full' &&
      selectedFund &&
      selectedFund.openPartialAmount > 0
    ) {
      Alert.alert(
        'Partial request open',
        'A partial withdrawal is already in process for this fund. You can only request the remaining principal until that request is resolved.'
      );
      return;
    }
    setStrategy(nextStrategy);
    if (nextStrategy === 'full') {
      setPartialAmountInput('');
    }
  };

  const loadFormOptions = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) {
      setFundOptions([]);
      setBankOptions([]);
      setIsLoadingOptions(false);
      return;
    }

    setIsLoadingOptions(true);

    try {
      const banks = await getUserBankAccounts(userId);
      setBankOptions(
        banks.map((bank) => ({
          id: bank.id,
          label: bank.label,
        }))
      );

      try {
        const funds = await getActiveInvestmentsForWithdrawal(userId);
        setFundOptions(
          funds.map((fund) => ({
            id: fund.id,
            label: fund.label,
            principal: fund.principal,
            withdrawalAmount: fund.withdrawalAmount,
            openPartialAmount: fund.openPartialAmount,
            availablePrincipal: fund.availablePrincipal,
            hasOpenFullWithdrawal: fund.hasOpenFullWithdrawal,
          }))
        );
      } catch (fundError) {
        if (!isMissingTableError(fundError)) {
          throw fundError;
        }
        setFundOptions([]);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load withdrawal form.';
      Alert.alert('Unable to load form', message);
    } finally {
      setIsLoadingOptions(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    loadFormOptions();
  }, [loadFormOptions]);

  const goToHistory = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('WithdrawalsList');
    }
  };

  const handleSubmitReview = async () => {
    const userId = session?.user?.id;
    if (!userId) {
      Alert.alert('Sign in required', 'Please sign in to submit a withdrawal request.');
      return;
    }

    if (!agreed) {
      Alert.alert(
        'Terms required',
        'You must agree to the Terms and Conditions before submitting.'
      );
      return;
    }

    if (!fundId) {
      Alert.alert('Fund required', 'Please select an active investment.');
      return;
    }

    if (!bankId) {
      Alert.alert('Bank account required', 'Please select a payout bank account.');
      return;
    }

    if (fundOptions.length === 0) {
      Alert.alert(
        'No active investments',
        'You need an active investment before creating a withdrawal request.'
      );
      return;
    }

    if (bankOptions.length === 0) {
      Alert.alert(
        'No bank accounts',
        'Add a bank account before submitting a withdrawal request.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const activeInvestment = await getActiveInvestmentForUser(userId, fundId);
      if (!activeInvestment) {
        Alert.alert(
          'Invalid investment',
          'Please select a valid active investment.'
        );
        return;
      }

      if (activeInvestment.hasOpenFullWithdrawal) {
        Alert.alert(
          'Withdrawal already requested',
          'A full withdrawal is already open for this fund. You can request again only if that request is rejected.'
        );
        return;
      }

      let withdrawalAmount: number;
      if (strategy === 'partial') {
        withdrawalAmount = parseInrInput(partialAmountInput);
        const validationError = validatePartialWithdrawalAmount(
          activeInvestment.principal,
          withdrawalAmount,
          activeInvestment.openPartialAmount
        );
        if (validationError) {
          Alert.alert('Invalid amount', validationError);
          return;
        }
      } else {
        if (activeInvestment.openPartialAmount > 0) {
          Alert.alert(
            'Partial request open',
            'Finish or wait for open partial withdrawals before requesting a full withdrawal.'
          );
          return;
        }
        withdrawalAmount = activeInvestment.withdrawalAmount;
      }

      const ownsBank = await verifyBankAccountOwnership(userId, bankId);
      if (!ownsBank) {
        Alert.alert('Invalid bank account', 'Please select a valid bank account.');
        return;
      }

      await createWithdrawalRequest({
        userId,
        investmentId: activeInvestment.id,
        bankAccountId: bankId,
        withdrawalAmount,
        strategy,
      });

      navigation.navigate('WithdrawalsList');
    } catch (error) {
      const message = isMissingTableError(error)
        ? MISSING_INVESTMENTS_TABLE_MESSAGE
        : error instanceof Error
          ? error.message
          : 'Failed to submit withdrawal request. Please try again.';
      Alert.alert('Submission failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goToHistory}
          activeOpacity={0.7}
          hitSlop={8}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create New Request</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardSafeScroll contentContainerStyle={styles.content}>
          <HistoryRequestTabs
            active="request"
            onHistory={goToHistory}
            onRequest={() => {
              /* already on Request tab */
            }}
          />

          {isLoadingOptions ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null}

          <FormSelectField
            label="Select Fund"
            mutedLabel
            placeholder={
              fundOptions.length === 0
                ? 'No active investments found'
                : 'Select Account...'
            }
            value={fundId}
            options={fundOptions}
            onChange={handleFundChange}
          />

          <FormSelectField
            label="Payout Bank Account"
            mutedLabel
            placeholder={
              bankOptions.length === 0 ? 'No bank accounts found' : 'Select Bank...'
            }
            value={bankId}
            options={bankOptions}
            onChange={setBankId}
          />

          <WithdrawalStrategyCards
            value={strategy}
            onChange={handleStrategyChange}
            disablePartial={
              !selectedFund || selectedFund.availablePrincipal <= 0
            }
          />

          <View style={styles.amountWrap}>
            <Text style={styles.fieldLabel}>Withdrawal Amount</Text>
            <View
              style={[
                styles.amountField,
                !isPartial && styles.amountFieldDisabled,
              ]}
            >
              <Text style={styles.currency}>₹</Text>
              <TextInput
                style={[
                  styles.amountInput,
                  !isPartial && styles.amountInputDisabled,
                ]}
                value={withdrawalAmountDisplay}
                editable={isPartial}
                keyboardType="numeric"
                onChangeText={setPartialAmountInput}
                placeholder={isPartial ? 'Enter amount' : '0.00'}
                placeholderTextColor={colors.textMuted}
              />
            </View>
            {partialAmountHint ? (
              <Text style={styles.amountHint}>{partialAmountHint}</Text>
            ) : null}
          </View>

          <RequestTimelineBar requestedDate={requestedDate} />

          <TouchableOpacity
            style={styles.termsBox}
            activeOpacity={0.85}
            onPress={() => setAgreed((prev) => !prev)}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed ? (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              ) : null}
            </View>
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text style={styles.termsLink}>Terms and Conditions</Text>. I
              understand that full withdrawals will close my account. Partial
              withdrawals reduce the invested principal for future earnings.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleSubmitReview}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Submit Review</Text>
            )}
          </TouchableOpacity>
      </KeyboardSafeScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -6,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 28,
  },
  loadingWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  amountWrap: {
    marginBottom: 18,
  },
  amountHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  amountField: {
    height: 56,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    backgroundColor: '#F7F8FA',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  amountFieldDisabled: {
    opacity: 0.85,
  },
  currency: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  amountInputDisabled: {
    color: colors.textSecondary,
  },
  termsBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 18,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  termsLink: {
    color: colors.primarySoft,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  submitBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
