import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import FormSelectField from '../../components/form/FormSelectField';
import { calculateRepaymentSchedule, getLoanProducts, LoanProduct, submitCustomLoanRequest, submitLoanRequest } from '../../services/borrowingService';
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
function newSubmissionKey() { return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`; }
type Props = BorrowingStackScreenProps<'LoanRequest'>;
export default function BorrowingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [requestType,setRequestType]=useState<'standard'|'custom'>('standard');
  const [productId, setProductId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [termText, setTermText] = useState('12');
  const [durationDaysText,setDurationDaysText]=useState('10');
  const [requestedInterestText,setRequestedInterestText]=useState('');
  const [repaymentPreference,setRepaymentPreference]=useState<'maturity'|'flexible'>('maturity');
  const [submissionKey,setSubmissionKey]=useState(newSubmissionKey);
  const [submittedRequestNumber,setSubmittedRequestNumber]=useState<string|null>(null);
  const [purpose, setPurpose] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');
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
    if (requestType==='standard'&&(!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 600 || !schedule.length)) {
      Alert.alert('Check the loan term', 'Enter a term from 1 to 600 months with a supported repayment schedule.'); return;
    }
    if(requestType==='custom'&&(!Number.isInteger(Number(durationDaysText))||Number(durationDaysText)<1||Number(durationDaysText)>3650)){Alert.alert('Check the loan term','Enter a duration from 1 to 3,650 days.');return;}
    if(requestType==='custom'&&requestedInterestText!==''&&(!Number.isFinite(Number(requestedInterestText))||Number(requestedInterestText)<0||Number(requestedInterestText)>100)){Alert.alert('Check requested interest','Enter a one-time flat interest rate from 0% to 100%.');return;}
    if (!purpose) { Alert.alert('Choose a purpose', 'Please tell us what the loan is for.'); return; }
    setStep(2);
  };

  const onSubmit = async () => {
    if (submittedRequestNumber || submitting) return;
    if (!product) { setSubmitError('Loan options are unavailable. Please go back and try again.'); return; }
    if (!purpose) { setSubmitError('Choose a purpose for this loan before submitting.'); return; }
    if (requestType === 'standard' && schedule.length === 0) { setSubmitError('The repayment schedule could not be calculated. Please review the loan details.'); return; }
    setSubmitError('');
    setSubmitting(true);
    try {
      if(requestType==='custom'){
        const result=await submitCustomLoanRequest({principalAmount:principal,durationDays:Number(durationDaysText),requestedInterestRatePercent:requestedInterestText===''?null:Number(requestedInterestText),repaymentPreference,purpose,notes:notes.trim(),submissionKey});
        setSubmittedRequestNumber(result.loanNumber);return;
      }
      const result = await submitLoanRequest({ productId: product.id, principalAmount: principal, termMonths, purpose, notes: notes.trim(), schedule });
      setSubmittedRequestNumber(result.loanNumber);
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'Unable to submit request. Please try again.');
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
          {submittedRequestNumber?<View style={styles.reviewCard}><View style={styles.estimateHead}><Ionicons name="checkmark-circle" size={25} color={colors.success}/><Text style={styles.reviewHeading}>Request submitted</Text></View><Text style={styles.metricLabel}>Your loan request {submittedRequestNumber} was sent to your client. You can track its status in your loans.</Text><TouchableOpacity style={styles.primaryButton} onPress={()=>{setSubmittedRequestNumber(null);setStep(1);setAmountText('');setNotes('');setPurpose(null);setRequestedInterestText('');setSubmissionKey(newSubmissionKey());navigation.navigate('BorrowingHome');}}><Text style={styles.primaryButtonText}>Back to loans</Text></TouchableOpacity></View>:<>
          {step === 1 ? <>
            <View style={styles.requestTypeRow}><TouchableOpacity style={[styles.requestTypeButton,requestType==='standard'&&styles.requestTypeActive]} onPress={()=>setRequestType('standard')}><Text style={[styles.requestTypeText,requestType==='standard'&&styles.requestTypeTextActive]}>Regular EMI</Text></TouchableOpacity><TouchableOpacity style={[styles.requestTypeButton,requestType==='custom'&&styles.requestTypeActive]} onPress={()=>setRequestType('custom')}><Text style={[styles.requestTypeText,requestType==='custom'&&styles.requestTypeTextActive]}>Custom loan</Text></TouchableOpacity></View>
            {product?<View style={styles.defaultTermsCard}><Text style={styles.estimateTitle}>Client’s default loan terms</Text><Text style={styles.defaultTermsText}>{Number(product.interest_rate_percent).toLocaleString('en-IN')}% {product.interest_rate_period} · {product.interest_model.replaceAll('_',' ')} interest</Text><Text style={styles.defaultTermsText}>Interest: {product.interest_frequency.replaceAll('_',' ')} · Repayment: {product.repayment_frequency.replaceAll('_',' ')}</Text><Text style={styles.defaultTermsText}>Grace period: {product.grace_period_days} days · Overdue: {product.overdue_rule.replaceAll('_',' ')}{Number(product.overdue_charge)>0?` (${product.overdue_rule==='percentage_charge'?`${product.overdue_charge}% of unpaid principal`:`₹${product.overdue_charge}`})`:''}</Text><Text style={styles.helper}>These client defaults are shown for reference. Custom requests receive a separate one-time flat interest offer from the client.</Text></View>:null}
            <View style={styles.card}>
              {requestType==='standard'?<View style={styles.fieldBlock}>
                <FormSelectField label="Loan product" required placeholder="Choose a product" value={productId} options={products.map((item) => ({ id: item.id, label: item.name }))} onChange={setProductId} />
                <Text style={styles.helper}>{product ? `${Number(product.interest_rate_percent).toLocaleString('en-IN')}% ${product.interest_rate_period} interest · ${product.repayment_model.replaceAll('_', ' ')}` : 'Choose the type of loan you need.'}</Text>
              </View>:null}
              <View style={styles.fieldBlock}>
                {fieldLabel('Requested amount', true)}
                <View style={styles.amountWrap}><Text style={styles.currency}>₹</Text><TextInput value={amountText} onChangeText={(value) => setAmountText(value.replace(/[^\d]/g, ''))} keyboardType="number-pad" placeholder="Enter amount" placeholderTextColor={colors.textMuted} style={styles.amountInput} /></View>
                <Text style={styles.helper}>Enter the amount you would like to borrow.</Text>
              </View>
              {requestType==='standard'?<View style={styles.fieldBlock}>
                {fieldLabel('Loan term', true)}
                <View style={styles.inlineInput}><TextInput value={termText} onChangeText={(value) => setTermText(value.replace(/[^\d]/g, ''))} keyboardType="number-pad" style={styles.textInput} /><Text style={styles.suffix}>months</Text></View>
                <Text style={styles.helper}>Choose a term in months. The repayment dates follow this product’s schedule.</Text>
              </View>:<><View style={styles.fieldBlock}>{fieldLabel('Requested term',true)}<View style={styles.inlineInput}><TextInput value={durationDaysText} onChangeText={value=>setDurationDaysText(value.replace(/[^\d]/g,''))} keyboardType="number-pad" style={styles.textInput}/><Text style={styles.suffix}>days</Text></View><Text style={styles.helper}>Day 1 is the day after disbursement.</Text></View><View style={styles.fieldBlock}>{fieldLabel('Requested flat interest (%)')}<TextInput value={requestedInterestText} onChangeText={value=>setRequestedInterestText(value.replace(/[^\d.]/g,''))} keyboardType="decimal-pad" style={styles.interestInput} placeholder="Optional" placeholderTextColor={colors.textMuted}/><Text style={styles.helper}>Request a one-time percentage for the whole loan term. Your client may offer different terms.</Text></View><View style={styles.fieldBlock}><Text style={styles.label}>Repayment preference</Text><View style={styles.preferenceRow}><TouchableOpacity style={[styles.preferenceButton,repaymentPreference==='maturity'&&styles.preferenceActive]} onPress={()=>setRepaymentPreference('maturity')}><Text style={[styles.preferenceText,repaymentPreference==='maturity'&&styles.preferenceTextActive]}>At maturity</Text></TouchableOpacity><TouchableOpacity style={[styles.preferenceButton,repaymentPreference==='flexible'&&styles.preferenceActive]} onPress={()=>setRepaymentPreference('flexible')}><Text style={[styles.preferenceText,repaymentPreference==='flexible'&&styles.preferenceTextActive]}>Flexible payments</Text></TouchableOpacity></View><Text style={styles.helper}>Flexible payments let you pay partial amounts on dates you choose.</Text></View></>}
              <View style={styles.fieldBlock}>
                <FormSelectField label="Purpose of loan" required placeholder="Select a purpose" value={purpose} options={PURPOSES} onChange={setPurpose} />
              </View>
              <View style={styles.fieldBlockLast}>
                {fieldLabel('Additional notes')}
                <TextInput value={notes} onChangeText={(value) => setNotes(value.slice(0, 500))} multiline maxLength={500} textAlignVertical="top" placeholder="Tell us more about your requirement…" placeholderTextColor={colors.textMuted} style={styles.notesInput} />
                <Text style={styles.counter}>{notes.length}/500</Text>
              </View>
            </View>

            {requestType==='standard'&&product && schedule.length > 0 && <View style={styles.estimateCard}>
              <View style={styles.estimateHead}><Ionicons name="calculator-outline" size={21} color={colors.primarySoft} /><Text style={styles.estimateTitle}>Repayment estimate</Text></View>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>Number of payments</Text><Text style={styles.metricValue}>{schedule.length}</Text></View>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>First payment date</Text><Text style={styles.metricValue}>{firstDue?.dueDate}</Text></View>
              <View style={[styles.metricRow, styles.totalRow]}><Text style={styles.metricLabelStrong}>Estimated total repayment</Text><Text style={styles.metricValueStrong}>{formatInr(totalDue)}</Text></View>
              <Text style={styles.helper}>Estimate uses this client’s loan rules. The client will review the request and confirm final terms.</Text>
            </View>}
            {requestType==='custom'?<View style={styles.estimateCard}><View style={styles.estimateHead}><Ionicons name="calculator-outline" size={21} color={colors.primarySoft}/><Text style={styles.estimateTitle}>Custom loan request</Text></View><Text style={styles.metricLabel}>Requesting {formatInr(principal)} for {durationDaysText} days · {repaymentPreference==='maturity'?'repay at maturity':'make flexible partial payments'}.</Text>{requestedInterestText!==''?<Text style={styles.metricLabel}>Requested interest: {requestedInterestText}% flat once · estimated interest {formatInr(principal*Number(requestedInterestText)/100)} · estimated total {formatInr(principal*(1+Number(requestedInterestText)/100))}.</Text>:null}<Text style={styles.helper}>Your client reviews the requested terms and may send one offer for you to accept or decline.</Text></View>:null}

          </> : <>
            {requestType==='standard'?<View style={styles.reviewCard}>
              <Text style={styles.reviewHeading}>Loan request</Text>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>Product</Text><Text style={styles.metricValue}>{product?.name}</Text></View>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>Amount requested</Text><Text style={styles.metricValue}>{formatInr(principal)}</Text></View>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>Term</Text><Text style={styles.metricValue}>{termMonths} months</Text></View>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>Purpose</Text><Text style={styles.metricValue}>{PURPOSES.find((item) => item.id === purpose)?.label}</Text></View>
              {notes.trim() ? <View style={styles.notesSummary}><Text style={styles.metricLabel}>Additional notes</Text><Text style={styles.noteValue}>{notes.trim()}</Text></View> : null}
            </View>:<View style={styles.reviewCard}><Text style={styles.reviewHeading}>Custom loan request</Text><View style={styles.metricRow}><Text style={styles.metricLabel}>Amount</Text><Text style={styles.metricValue}>{formatInr(principal)}</Text></View><View style={styles.metricRow}><Text style={styles.metricLabel}>Term</Text><Text style={styles.metricValue}>{durationDaysText} days</Text></View>{requestedInterestText!==''?<View style={styles.metricRow}><Text style={styles.metricLabel}>Requested flat interest</Text><Text style={styles.metricValue}>{requestedInterestText}% · estimated total {formatInr(principal*(1+Number(requestedInterestText)/100))}</Text></View>:null}<View style={styles.metricRow}><Text style={styles.metricLabel}>Repayment preference</Text><Text style={styles.metricValue}>{repaymentPreference==='maturity'?'At maturity':'Flexible payments'}</Text></View><Text style={styles.helper}>Your client will review your request and can send one offer before disbursement.</Text></View>}
            {requestType==='standard'?<View style={styles.estimateCard}>
              <View style={styles.estimateHead}><Ionicons name="calendar-outline" size={21} color={colors.primarySoft} /><Text style={styles.estimateTitle}>Projected repayment plan</Text></View>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>Interest rate</Text><Text style={styles.metricValue}>{Number(product?.interest_rate_percent).toLocaleString('en-IN')}% / {product?.interest_rate_period}</Text></View>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>Payment frequency</Text><Text style={styles.metricValue}>{product?.repayment_frequency.replaceAll('_', ' ')}</Text></View>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>Number of payments</Text><Text style={styles.metricValue}>{schedule.length}</Text></View>
              <View style={[styles.metricRow, styles.totalRow]}><Text style={styles.metricLabelStrong}>Estimated total repayment</Text><Text style={styles.metricValueStrong}>{formatInr(totalDue)}</Text></View>
              <Text style={styles.helper}>This is an estimate calculated on this device. Final approved amount, rate, dates, and terms are subject to your client’s review.</Text>
            </View>:null}
          </>}

          {step === 2 && submitError ? <View accessibilityRole="alert" style={styles.submitError}><Ionicons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.submitErrorText}>{submitError}</Text></View> : null}
          <TouchableOpacity style={[styles.primaryButton, submitting && styles.disabled]} onPress={() => { if (step === 1) onContinue(); else void onSubmit(); }} disabled={submitting} activeOpacity={0.85}>
            {submitting ? <ActivityIndicator color="#FFF" /> : <><Text style={styles.primaryButtonText}>{step === 1 ? 'Review request' : 'Submit loan request'}</Text><Ionicons name="arrow-forward" size={19} color="#FFF" /></>}
          </TouchableOpacity>
          {step === 2 ? <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)} disabled={submitting}><Text style={styles.backText}>Back to edit</Text></TouchableOpacity> : null}
          <Text style={styles.secure}><Ionicons name="lock-closed-outline" size={13} color={colors.textSecondary} /> Your information is used only for this loan request.</Text>
          </>}
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
  interestInput: { minHeight: 50, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, paddingHorizontal: 14, color: colors.textPrimary, fontSize: 16 },
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
  submitError: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECDD3' },
  submitErrorText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 19 },
  backButton: { alignItems: 'center', padding: 12 },
  backText: { color: colors.primarySoft, fontWeight: '700', fontSize: 14 },
  secure: { textAlign: 'center', color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: 12 },
  requestTypeRow: { flexDirection: 'row', gap: 8 },
  requestTypeButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  requestTypeActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  requestTypeText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  requestTypeTextActive: { color: '#FFF' },
  defaultTermsCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 },
  defaultTermsText: { color: colors.textPrimary, fontWeight: '700', fontSize: 13, marginTop: 5 },
  preferenceRow: { flexDirection: 'row', gap: 8 },
  preferenceButton: { flex: 1, paddingVertical: 11, borderRadius: 11, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  preferenceActive: { borderColor: colors.primary, backgroundColor: '#F0EDFF' },
  preferenceText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  preferenceTextActive: { color: colors.primary },
});
