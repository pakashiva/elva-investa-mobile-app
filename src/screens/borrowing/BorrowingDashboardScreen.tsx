import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorrowingStackScreenProps } from '../../navigation/types';
import { BorrowingSnapshot, getBorrowingSnapshot } from '../../services/borrowingService';
import { formatInr } from '../../utils/currency';
import { colors, spacing } from '../../theme/colors';

type Props = BorrowingStackScreenProps<'BorrowingHome'>;
const num = (value: string | number | null | undefined) => Number(value ?? 0) || 0;
const todayInIndia = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

function allocations(principalDue: number, interestDue: number, overdueDue: number, paid: number, order: 'principal_first' | 'interest_first') {
  let remaining = paid;
  const parts = order === 'principal_first'
    ? [{ principalDue }, { interestDue }, { overdueDue }]
    : [{ overdueDue }, { interestDue }, { principalDue }];
  const result = { principal: 0, interest: 0, overdue: 0 };
  for (const part of parts) {
    const [key, amount] = Object.entries(part)[0] as [keyof typeof result, number];
    result[key] = Math.min(amount, remaining);
    remaining = Math.max(0, remaining - amount);
  }
  return result;
}

export function getBorrowingMetrics(snapshot: BorrowingSnapshot, today = todayInIndia()) {
  const active = snapshot.loans.filter((loan) => ['active', 'overdue'].includes(loan.status));
  const activeIds = new Set(active.map((loan) => loan.id));
  const outstandingPrincipal = snapshot.ledger.filter((row) => activeIds.has(row.loan_id ?? '')).reduce(
    (sum, row) => sum + num(row.principal_debit) - num(row.principal_credit), 0
  );
  let interestDue = 0;
  let overdueAmount = 0;
  let nextPayment: { amount: number; date: string } | null = null;
  for (const loan of active) {
    const productOrder = String(loan.terms_snapshot.payment_allocation ?? 'interest_first') === 'principal_first' ? 'principal_first' : 'interest_first';
    for (const schedule of snapshot.schedules.filter((item) => item.loan_id === loan.id)) {
      const principal = num(schedule.principal_due);
      const interest = num(schedule.interest_due);
      const charge = num(schedule.overdue_charge);
      const split = allocations(principal, interest, charge, num(schedule.amount_paid), productOrder);
      const leftPrincipal = Math.max(0, principal - split.principal);
      const leftInterest = Math.max(0, interest - split.interest);
      const leftOverdue = Math.max(0, charge - split.overdue);
      const remaining = leftPrincipal + leftInterest + leftOverdue;
      const graceDeadline = new Date(`${schedule.due_date}T00:00:00+05:30`);
      graceDeadline.setDate(graceDeadline.getDate() + Math.max(0, Number(loan.grace_period_days) || 0));
      const graceDate = `${graceDeadline.getFullYear()}-${String(graceDeadline.getMonth() + 1).padStart(2, '0')}-${String(graceDeadline.getDate()).padStart(2, '0')}`;
      const isOverdue = graceDate < today && schedule.status !== 'paid' && schedule.status !== 'waived';
      if (schedule.due_date <= today) interestDue += leftInterest;
      if (isOverdue) overdueAmount += remaining;
      if (!nextPayment && schedule.due_date >= today && remaining > 0 && schedule.status !== 'paid' && schedule.status !== 'waived') {
        nextPayment = { amount: remaining, date: schedule.due_date };
      }
    }
  }
  return {
    activeCount: active.length,
    awaitingCount: snapshot.loans.filter((loan) => ['pending_approval', 'approved'].includes(loan.status)).length,
    outstandingPrincipal: Math.max(0, outstandingPrincipal),
    interestDue: Math.max(0, interestDue),
    overdueAmount: Math.max(0, overdueAmount),
    nextPayment,
    recentPayments: snapshot.payments.filter((payment) => payment.status === 'posted').slice(0, 5),
  };
}

export default function BorrowingDashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [snapshot, setSnapshot] = useState<BorrowingSnapshot>({ loans: [], schedules: [], ledger: [], payments: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try { setSnapshot(await getBorrowingSnapshot()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load your loan information.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const metrics = getBorrowingMetrics(snapshot);
  const activeLoans = snapshot.loans.filter((loan) => ['active', 'overdue'].includes(loan.status));

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) + 8 }]}>
        <Text style={styles.eyebrow}>YOUR BORROWING</Text>
        <View style={styles.titleRow}><View style={{ flex: 1 }}><Text style={styles.title}>Loans & repayments</Text><Text style={styles.subtitle}>Your loan status and upcoming payments.</Text></View><TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('LoanRequest')}><Ionicons name="add" size={19} color="#FFF" /><Text style={styles.addText}>Request</Text></TouchableOpacity></View>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.muted}>Calculating your loan summary…</Text></View> : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 24 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />} showsVerticalScrollIndicator={false}>
          {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text><TouchableOpacity onPress={() => void load(true)}><Text style={styles.retry}>Retry</Text></TouchableOpacity></View> : null}
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>OUTSTANDING PRINCIPAL</Text><Text style={styles.heroValue}>{formatInr(metrics.outstandingPrincipal)}</Text>
            <View style={styles.heroDivider} />
            <View style={styles.heroBottom}><View><Text style={styles.heroSmall}>Interest due</Text><Text style={styles.heroSmallValue}>{formatInr(metrics.interestDue)}</Text></View><View style={styles.heroBottomDivider} /><View><Text style={styles.heroSmall}>Overdue</Text><Text style={[styles.heroSmallValue, metrics.overdueAmount > 0 && { color: '#F6C36B' }]}>{formatInr(metrics.overdueAmount)}</Text></View></View>
          </View>
          {metrics.nextPayment ? <View style={styles.nextCard}><View style={styles.nextIcon}><Ionicons name="calendar-outline" size={21} color={colors.primarySoft} /></View><View style={{ flex: 1 }}><Text style={styles.nextLabel}>NEXT PAYMENT</Text><Text style={styles.nextDate}>{metrics.nextPayment.date}</Text></View><Text style={styles.nextAmount}>{formatInr(metrics.nextPayment.amount)}</Text></View> : null}
          <View style={styles.summaryRow}><Metric label="Active loans" value={String(metrics.activeCount)} icon="briefcase-outline" /><Metric label="Awaiting decision" value={String(metrics.awaitingCount)} icon="time-outline" /></View>
          <SectionHeader title="My loans" count={snapshot.loans.length} />
          {snapshot.loans.length ? snapshot.loans.map((loan) => {
            const remainingPrincipal = Math.max(0, snapshot.ledger.filter((row) => row.loan_id === loan.id).reduce((sum, row) => sum + num(row.principal_debit) - num(row.principal_credit), 0));
            return <TouchableOpacity key={loan.id} style={styles.loanCard} activeOpacity={0.76} onPress={() => navigation.navigate('BorrowingLoanDetails', { loanId: loan.id })}>
              <View style={styles.loanTitleRow}><View style={styles.loanIcon}><Ionicons name="business-outline" size={19} color={colors.primarySoft} /></View><View style={{ flex: 1 }}><Text style={styles.loanName}>{loan.product_name}</Text><Text style={styles.loanCode}>{loan.loan_number}</Text></View><View style={[styles.statusPill, statusColor(loan.status)]}><Text style={[styles.statusText, statusTextColor(loan.status)]}>{loan.status.replaceAll('_', ' ')}</Text></View></View>
              <View style={styles.loanBottom}><View><Text style={styles.cardHint}>Requested / original amount</Text><Text style={styles.cardValue}>{formatInr(num(loan.principal_amount))}</Text></View><View style={{ alignItems: 'flex-end' }}><Text style={styles.cardHint}>Principal outstanding</Text><Text style={styles.cardValue}>{formatInr(remainingPrincipal)}</Text></View></View>
              <View style={styles.viewDetails}><Text style={styles.viewDetailsText}>View loan details</Text><Ionicons name="chevron-forward" size={16} color={colors.primarySoft} /></View>
            </TouchableOpacity>;
          }) : <View style={styles.empty}><Ionicons name="file-tray-outline" size={30} color={colors.textMuted} /><Text style={styles.emptyTitle}>No loan requests yet</Text><Text style={styles.muted}>When you request a loan, its status and details will appear here.</Text><TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('LoanRequest')}><Text style={styles.emptyButtonText}>Request a loan</Text></TouchableOpacity></View>}
          <SectionHeader title="Recent payments" />
          {metrics.recentPayments.length ? metrics.recentPayments.map((payment) => {
            const loan = snapshot.loans.find((item) => item.id === payment.loan_id);
            return <View key={payment.id} style={styles.paymentRow}><View style={styles.paymentIcon}><Ionicons name="checkmark-circle-outline" size={21} color={colors.success} /></View><View style={{ flex: 1 }}><Text style={styles.paymentTitle}>{loan?.loan_number ?? 'Loan payment'}</Text><Text style={styles.cardHint}>{payment.received_on} · Receipt {payment.id.slice(0, 8).toUpperCase()}</Text></View><Text style={styles.paymentAmount}>{formatInr(num(payment.amount_received))}</Text></View>;
          }) : <Text style={styles.muted}>No payments recorded yet.</Text>}
        </ScrollView>
      )}
    </View>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return <View style={styles.metricCard}><Ionicons name={icon} size={20} color={colors.primarySoft} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}
function SectionHeader({ title, count }: { title: string; count?: number }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{count != null ? <Text style={styles.sectionCount}>{count}</Text> : null}</View>;
}
function statusColor(status: string) { return status === 'active' ? styles.activePill : status === 'overdue' ? styles.overduePill : status === 'rejected' ? styles.rejectedPill : styles.pendingPill; }
function statusTextColor(status: string) { return status === 'active' ? styles.activeText : status === 'overdue' ? styles.overdueText : status === 'rejected' ? styles.rejectedText : styles.pendingText; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, header: { backgroundColor: colors.surface, paddingHorizontal: spacing.screen, paddingBottom: 17, borderBottomColor: colors.border, borderBottomWidth: 1 },
  eyebrow: { color: colors.primarySoft, letterSpacing: 1.4, fontWeight: '800', fontSize: 10, marginBottom: 6 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary }, subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  addButton: { flexDirection: 'row', gap: 3, alignItems: 'center', backgroundColor: colors.primary, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 10 }, addText: { color: '#FFF', fontSize: 12, fontWeight: '700' }, content: { padding: spacing.screen, gap: 14 },
  heroCard: { backgroundColor: colors.primary, borderRadius: 18, padding: 18 }, heroLabel: { color: '#CCD0F5', fontWeight: '700', letterSpacing: 1.1, fontSize: 10 }, heroValue: { color: '#FFF', fontSize: 29, fontWeight: '800', marginTop: 6 }, heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 14 }, heroBottom: { flexDirection: 'row', alignItems: 'center' }, heroBottomDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 22 }, heroSmall: { color: '#CCD0F5', fontSize: 11 }, heroSmallValue: { color: '#FFF', fontSize: 15, fontWeight: '700', marginTop: 3 },
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.surface, borderRadius: 14, padding: 13, borderWidth: 1, borderColor: colors.border }, nextIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#F0EDFF', alignItems: 'center', justifyContent: 'center' }, nextLabel: { color: colors.textSecondary, letterSpacing: 0.8, fontSize: 9, fontWeight: '800' }, nextDate: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 3 }, nextAmount: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  summaryRow: { flexDirection: 'row', gap: 10 }, metricCard: { flex: 1, backgroundColor: colors.surface, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: colors.border }, metricValue: { color: colors.textPrimary, fontSize: 21, fontWeight: '800', marginTop: 5 }, metricLabel: { color: colors.textSecondary, fontSize: 11, marginTop: 1 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 }, sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' }, sectionCount: { color: colors.textSecondary, fontSize: 12 },
  loanCard: { backgroundColor: colors.surface, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: colors.border }, loanTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, loanIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0EDFF', alignItems: 'center', justifyContent: 'center' }, loanName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary }, loanCode: { fontSize: 11, color: colors.textSecondary, marginTop: 2 }, statusPill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 }, statusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' }, activePill: { backgroundColor: colors.successBg }, overduePill: { backgroundColor: '#FCE8E7' }, pendingPill: { backgroundColor: colors.pendingBg }, rejectedPill: { backgroundColor: '#FCE8E7' }, activeText: { color: colors.successText }, overdueText: { color: '#B42318' }, pendingText: { color: colors.pendingText }, rejectedText: { color: '#B42318' }, loanBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, gap: 8 }, cardHint: { color: colors.textSecondary, fontSize: 10 }, cardValue: { color: colors.textPrimary, fontWeight: '700', fontSize: 13, marginTop: 3 }, viewDetails: { flexDirection: 'row', gap: 3, justifyContent: 'flex-end', alignItems: 'center', marginTop: 12, paddingTop: 9, borderTopColor: colors.border, borderTopWidth: 1 }, viewDetailsText: { color: colors.primarySoft, fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 15, padding: 20, gap: 7 }, emptyTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '800' }, muted: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 }, emptyButton: { backgroundColor: colors.primary, paddingHorizontal: 17, paddingVertical: 10, borderRadius: 10, marginTop: 5 }, emptyButtonText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: colors.surface, borderRadius: 13, borderWidth: 1, borderColor: colors.border }, paymentIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' }, paymentTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' }, paymentAmount: { color: colors.textPrimary, fontSize: 13, fontWeight: '800' }, error: { padding: 12, backgroundColor: '#FFF0EF', borderRadius: 12 }, errorText: { color: colors.danger, fontSize: 12 }, retry: { color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 6 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
});
