import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import FormSelectField from '../../components/form/FormSelectField';
import { calculateRepaymentSchedule, getLoanProducts, LoanProduct, submitLoanRequest } from '../../services/borrowingService';
import { colors, spacing } from '../../theme/colors';
import { formatInr } from '../../utils/currency';
import { BorrowingStackScreenProps } from '../../navigation/types';

const PURPOSES = [
  { id: 'business', label: 'Business / Working Capital' },
  { id: 'education', label: 'Education' },
  { id: 'medical', label: 'Medical expenses' },
  { id: 'home', label: 'Home or personal use' },
  { id: 'other', label: 'Other' },
];

function numberFromAmount(value: string) { return Number(value.replace(/[^\d.]/g, '')); }
type Props = BorrowingStackScreenProps<'LoanRequest'>;
export default function BorrowingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [termText, setTermText] = useState('12');
  const [purpose, setPurpose] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const product = products.find((item) => item.id === productId) ?? null;
  const principal = numberFromAmount(amountText);
  const termMonths = Number(termText);
  const schedule = useMemo(() => product
    ? calculateRepaymentSchedule(product, principal, termMonths)
    : [], [product, principal, termMonths]);
  const totalDue = schedule.reduce((sum, item) => sum + item.principalDue + item.interestDue, 0);
  const firstDue = schedule[0];

  useEffect(() => {
    let active = true;
    setLoading(true);
    getLoanProducts().then((result) => {
      if (active) {
        setProducts(result);
        setProductId((current) => current && result.some((item) => item.id === current) ? current : result[0]?.id ?? null);
        setError(result.length ? '' : 'No loan products are available right now. Please contact your client.');
      }
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Unable to load loan products.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.customer?.clientId]);

  const onContinue = () => {
    if (!product) { Alert.alert('Choose a loan product', 'Please select an available loan product.'); return; }
    if (!Number.isFinite(principal) || principal <= 0) { Alert.alert('Enter an amount', 'Enter a loan amount greater than zero.'); return; }
    if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 600 || !schedule.length) {
      Alert.alert('Check the loan term', 'Enter a term from 1 to 600 months with a supported repayment schedule.'); return;
    }
    if (!purpose) { Alert.alert('Choose a purpose', 'Please tell us what the loan is for.'); return; }
    setStep(2);
  };

  const onSubmit = async () => {
    if (!product || !purpose || schedule.length === 0) return;
    setSubmitting(true);
    try {
      const result = await submitLoanRequest({ productId: product.id, principalAmount: principal, termMonths, purpose, notes: notes.trim(), schedule });
      Alert.alert('Request submitted', `Your loan request ${result.loanNumber} has been sent for review.`, [
        { text: 'Done', onPress: () => { setStep(1); setAmountText(''); setNotes(''); setPurpose(null); navigation.navigate('BorrowingHome'); } },
      ]);
    } catch (cause) {
      Alert.alert('Unable to submit request', cause instanceof Error ? cause.message : 'Please try again.');
    } finally { setSubmitting(false); }
  };

  const fieldLabel = (title: string, required = false) => <Text style={styles.label}>{title}{required ? <Text style={styles.required}> *</Text> : null}</Text>;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>BORROWING</Text>
            <Text style={styles.title}>{step === 1 ? 'Request a loan' : 'Review your request'}</Text>
            <Text style={styles.subtitle}>{step === 1 ? 'Tell us how much you need.' : 'Check your repayment estimate before submitting.'}</Text>
          </View>
          <View style={styles.stepPill}><Text style={styles.stepText}>{step} of 2</Text></View>
        </View>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.helper}>Loading loan options…</Text></View> : error ? (
        <View style={styles.empty}><Ionicons name="information-circle-outline" size={34} color={colors.primarySoft} /><Text style={styles.emptyTitle}>Borrowing unavailable</Text><Text style={styles.helper}>{error}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 26 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {step === 1 ? <>
            <View style={styles.card}>
              <View style={styles.fieldBlock}>
                <FormSelectField label="Loan product" required placeholder="Choose a product" value={productId} options={products.map((item) => ({ id: item.id, label: item.name }))} onChange={setProductId} />
                <Text style={styles.helper}>{product ? `${Number(product.interest_rate_percent).toLocaleString('en-IN')}% ${product.interest_rate_period} interest · ${product.repayment_model.replaceAll('_', ' ')}` : 'Choose the type of loan you need.'}</Text>
              </View>
              <View style={styles.fieldBlock}>
                {fieldLabel('Requested amount', true)}
                <View style={styles.amountWrap}><Text style={styles.currency}>₹</Text><TextInput value={amountText} onChangeText={(value) => setAmountText(value.replace(/[^\d]/g, ''))} keyboardType="number-pad" placeholder="Enter amount" placeholderTextColor={colors.textMuted} style={styles.amountInput} /></View>
                <Text style={styles.helper}>Enter the amount you would like to borrow.</Text>
              </View>
              <View style={styles.fieldBlock}>
                {fieldLabel('Loan term', true)}
                <View style={styles.inlineInput}><TextInput value={termText} onChangeText={(value) => setTermText(value.replace(/[^\d]/g, ''))} keyboardType="number-pad" style={styles.textInput} /><Text style={styles.suffix}>months</Text></View>
                <Text style={styles.helper}>Choose a term in months. The repayment dates follow this product’s schedule.</Text>
              </View>
              <View style={styles.fieldBlock}>
                <FormSelectField label="Purpose of loan" required placeholder="Select a purpose" value={purpose} options={PURPOSES} onChange={setPurpose} />
              </View>
              <View style={styles.fieldBlockLast}>
                {fieldLabel('Additional notes')}
                <TextInput value={notes} onChangeText={(value) => setNotes(value.slice(0, 500))} multiline maxLength={500} textAlignVertical="top" placeholder="Tell us more about your requirement…" placeholderTextColor={colors.textMuted} style={styles.notesInput} />
                <Text style={styles.counter}>{notes.length}/500</Text>
              </View>
            </View>

            {product && schedule.length > 0 && <View style={styles.estimateCard}>
              <View style={styles.estimateHead}><Ionicons name="calculator-outline" size={21} color={colors.primarySoft} /><Text style={styles.estimateTitle}>Repayment estimate</Text></View>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>Number of payments</Text><Text style={styles.metricValue}>{schedule.length}</Text></View>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>First payment date</Text><Text style={styles.metricValue}>{firstDue?.dueDate}</Text></View>
              <View style={[styles.metricRow, styles.totalRow]}><Text style={styles.metricLabelStrong}>Estimated total repayment</Text><Text style={styles.metricValueStrong}>{formatInr(totalDue)}</Text></View>
              <Text style={styles.helper}>Estimate uses this client’s loan rules. The client will review the request and confirm final terms.</Text>
            </View>}

          </> : <>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewHeading}>Loan request</Text>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>Product</Text><Text style={styles.metricValue}>{product?.name}</Text></View>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>Amount requested</Text><Text style={styles.metricValue}>{formatInr(principal)}</Text></View>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>Term</Text><Text style={styles.metricValue}>{termMonths} months</Text></View>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>Purpose</Text><Text style={styles.metricValue}>{PURPOSES.find((item) => item.id === purpose)?.label}</Text></View>
              {notes.trim() ? <View style={styles.notesSummary}><Text style={styles.metricLabel}>Additional notes</Text><Text style={styles.noteValue}>{notes.trim()}</Text></View> : null}
            </View>
            <View style={styles.estimateCard}>
              <View style={styles.estimateHead}><Ionicons name="calendar-outline" size={21} color={colors.primarySoft} /><Text style={styles.estimateTitle}>Projected repayment plan</Text></View>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>Interest rate</Text><Text style={styles.metricValue}>{Number(product?.interest_rate_percent).toLocaleString('en-IN')}% / {product?.interest_rate_period}</Text></View>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>Payment frequency</Text><Text style={styles.metricValue}>{product?.repayment_frequency.replaceAll('_', ' ')}</Text></View>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>Number of payments</Text><Text style={styles.metricValue}>{schedule.length}</Text></View>
              <View style={[styles.metricRow, styles.totalRow]}><Text style={styles.metricLabelStrong}>Estimated total repayment</Text><Text style={styles.metricValueStrong}>{formatInr(totalDue)}</Text></View>
              <Text style={styles.helper}>This is an estimate calculated on this device. Final approved amount, rate, dates, and terms are subject to your client’s review.</Text>
            </View>
          </>}

          <TouchableOpacity style={[styles.primaryButton, submitting && styles.disabled]} onPress={step === 1 ? onContinue : onSubmit} disabled={submitting} activeOpacity={0.85}>
            {submitting ? <ActivityIndicator color="#FFF" /> : <><Text style={styles.primaryButtonText}>{step === 1 ? 'Review request' : 'Submit loan request'}</Text><Ionicons name="arrow-forward" size={19} color="#FFF" /></>}
          </TouchableOpacity>
          {step === 2 ? <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)} disabled={submitting}><Text style={styles.backText}>Back to edit</Text></TouchableOpacity> : null}
          <Text style={styles.secure}><Ionicons name="lock-closed-outline" size={13} color={colors.textSecondary} /> Your information is used only for this loan request.</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface, paddingHorizontal: spacing.screen, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.border },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headingCopy: { flex: 1 },
  eyebrow: { color: colors.primarySoft, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 5 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  stepPill: { backgroundColor: '#ECEAFF', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 },
  stepText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  content: { padding: spacing.screen, gap: 14 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border },
  fieldBlock: { marginBottom: 8 },
  fieldBlockLast: { marginTop: 4 },
  label: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  required: { color: colors.danger },
  amountWrap: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: 14 },
  currency: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginRight: 8 },
  amountInput: { flex: 1, color: colors.textPrimary, fontSize: 17, fontWeight: '700', paddingVertical: 10 },
  inlineInput: { minHeight: 50, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  textInput: { flex: 1, color: colors.textPrimary, fontSize: 16, paddingVertical: 10 },
  suffix: { color: colors.textSecondary, fontSize: 14 },
  notesInput: { minHeight: 104, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, padding: 13, color: colors.textPrimary, fontSize: 14 },
  counter: { color: colors.textSecondary, fontSize: 11, textAlign: 'right', marginTop: 5 },
  helper: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 5 },
  estimateCard: { backgroundColor: '#F0F5FF', borderWidth: 1, borderColor: '#DDE7FA', borderRadius: 16, padding: 16 },
  estimateHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  estimateTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '800' },
  metricRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  metricLabel: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  metricValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', textAlign: 'right', flex: 1 },
  totalRow: { borderTopWidth: 1, borderTopColor: '#D9E2F3', marginTop: 5, paddingTop: 12 },
  metricLabelStrong: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', flex: 1 },
  metricValueStrong: { color: colors.primary, fontSize: 15, fontWeight: '800', textAlign: 'right', flex: 1 },
  reviewCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  reviewHeading: { color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  notesSummary: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6, paddingTop: 12 },
  noteValue: { color: colors.textPrimary, fontSize: 13, lineHeight: 19, marginTop: 6 },
  primaryButton: { minHeight: 54, backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 3 },
  primaryButtonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.7 },
  backButton: { alignItems: 'center', padding: 12 },
  backText: { color: colors.primarySoft, fontWeight: '700', fontSize: 14 },
  secure: { textAlign: 'center', color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: 12 },
});
