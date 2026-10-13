import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorrowingLoanDetail, getBorrowingDocument, getBorrowingLoanDetail } from '../../services/borrowingService';
import { BorrowingStackScreenProps } from '../../navigation/types';
import { colors, spacing } from '../../theme/colors';
import { formatInr } from '../../utils/currency';

type Props = BorrowingStackScreenProps<'BorrowingLoanDetails'>;
const amount = (v: number | string | null | undefined) => Number(v ?? 0) || 0;
const display = (v: string) => v.replaceAll('_', ' ');

export default function BorrowingLoanDetailsScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<BorrowingLoanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ uri: string; name: string } | null>(null);
  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try { setDetail(await getBorrowingLoanDetail(route.params.loanId)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [route.params.loanId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openDocument = async (id: string) => {
    setOpening(id);
    try {
      const file = await getBorrowingDocument(id);
      setPreview({ uri: `data:${file.mime_type};base64,${file.base64}`, name: file.original_name });
    } finally { setOpening(null); }
  };

  if (loading && !detail) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.muted}>Loading loan details…</Text></View>;
  if (!detail) return <View style={styles.center}><Text style={styles.heading}>Loan details unavailable</Text><TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.link}>Go back</Text></TouchableOpacity></View>;
  const { loan, schedules, payments, ledger, documents } = detail;
  const principalBalance = Math.max(0, ledger.reduce((sum, row) => sum + amount(row.principal_debit) - amount(row.principal_credit), 0));
  const totalInterest = ledger.reduce((sum, row) => sum + amount(row.interest_debit) - amount(row.interest_credit), 0);

  return <View style={styles.screen}>
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) + 7 }]}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={22} color={colors.textPrimary} /></TouchableOpacity>
      <View style={{ flex: 1 }}><Text style={styles.eyebrow}>LOAN DETAILS</Text><Text style={styles.heading}>{loan.loan_number}</Text></View>
      <View style={[styles.status, loan.status === 'active' ? styles.active : styles.waiting]}><Text style={styles.statusText}>{display(loan.status)}</Text></View>
    </View>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 18) + 24 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}>
      <View style={styles.hero}><Text style={styles.product}>{loan.product_name}</Text><Text style={styles.labelLight}>ORIGINAL PRINCIPAL</Text><Text style={styles.big}>{formatInr(amount(loan.principal_amount))}</Text><View style={styles.heroLine}/><View style={styles.row}><View><Text style={styles.labelLight}>Principal outstanding</Text><Text style={styles.heroMetric}>{formatInr(principalBalance)}</Text></View><View><Text style={styles.labelLight}>Interest balance</Text><Text style={styles.heroMetric}>{formatInr(Math.max(0,totalInterest))}</Text></View></View></View>
      <View style={styles.card}><Text style={styles.sectionTitle}>Loan summary</Text><Info label="Interest rate" value={`${loan.interest_rate_percent}% / ${loan.interest_rate_period}`} /><Info label="Repayment plan" value={`${display(loan.repayment_model)} · ${display(loan.repayment_frequency)}`} /><Info label="Start date" value={loan.start_date ?? 'Pending disbursement'} /><Info label="Maturity date" value={loan.maturity_date ?? 'Not set'} /><Info label="Payment grace period" value={`${loan.grace_period_days} days`} /></View>
      <View style={styles.card}><Text style={styles.sectionTitle}>Repayment schedule</Text>{schedules.length ? schedules.map((item) => <View key={item.id} style={styles.scheduleRow}><View style={styles.scheduleIcon}><Ionicons name={item.status === 'paid' ? 'checkmark' : 'calendar-outline'} size={16} color={item.status === 'paid' ? colors.success : colors.primarySoft}/></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>Installment {item.installment_number}</Text><Text style={styles.caption}>{item.due_date} · {display(item.status)}</Text><Text style={styles.caption}>Principal {formatInr(amount(item.principal_due))} · Interest {formatInr(amount(item.interest_due))}</Text></View><Text style={styles.rowAmount}>{formatInr(amount(item.principal_due)+amount(item.interest_due)+amount(item.overdue_charge))}</Text></View>) : <Text style={styles.muted}>The repayment schedule will appear after the loan is approved.</Text>}</View>
      <View style={styles.card}><Text style={styles.sectionTitle}>Payment & receipt history</Text>{payments.length ? payments.map((item) => <View key={item.id} style={styles.historyRow}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.received_on} · {display(item.status)}</Text><Text style={styles.caption}>Receipt {item.reference_number || item.id.slice(0, 8).toUpperCase()}</Text><Text style={styles.caption}>Principal {formatInr(amount(item.principal_component))} · Interest {formatInr(amount(item.interest_component))}</Text></View><Text style={styles.rowAmount}>{formatInr(amount(item.amount_received))}</Text></View>) : <Text style={styles.muted}>No payments have been recorded yet.</Text>}</View>
      <View style={styles.card}><Text style={styles.sectionTitle}>Account ledger</Text>{ledger.length ? ledger.map((item) => <View key={item.id} style={styles.historyRow}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{display(item.event_type)}</Text><Text style={styles.caption}>{item.event_date} · {item.description}</Text></View><Text style={styles.rowAmount}>{formatInr(amount(item.principal_debit)+amount(item.interest_debit)+amount(item.overdue_debit)-amount(item.principal_credit)-amount(item.interest_credit)-amount(item.overdue_credit))}</Text></View>) : <Text style={styles.muted}>Ledger entries will appear here as the loan is processed.</Text>}</View>
      <View style={styles.card}><Text style={styles.sectionTitle}>Supporting documents</Text>{documents.length ? documents.map((doc) => <TouchableOpacity key={doc.id} style={styles.documentRow} onPress={() => void openDocument(doc.id)} disabled={opening === doc.id}><Ionicons name="document-attach-outline" size={20} color={colors.primarySoft}/><Text numberOfLines={1} style={styles.documentName}>{doc.original_name}</Text>{opening === doc.id ? <ActivityIndicator color={colors.primary}/> : <Ionicons name="open-outline" size={18} color={colors.textSecondary}/>}</TouchableOpacity>) : <Text style={styles.muted}>No documents attached to this loan.</Text>}</View>
    </ScrollView>
    <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}><View style={styles.modal}><TouchableOpacity style={styles.close} onPress={() => setPreview(null)}><Ionicons name="close" size={25} color="#FFF"/></TouchableOpacity><Text style={styles.previewTitle}>{preview?.name}</Text>{preview ? <Image source={{ uri: preview.uri }} resizeMode="contain" style={styles.previewImage}/> : null}</View></Modal>
  </View>;
}

function Info({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.caption}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }
const styles = StyleSheet.create({ screen:{flex:1,backgroundColor:colors.background},header:{backgroundColor:colors.surface,paddingHorizontal:spacing.screen,paddingBottom:14,flexDirection:'row',alignItems:'center',gap:11,borderBottomWidth:1,borderColor:colors.border},back:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:colors.background},eyebrow:{fontSize:9,letterSpacing:1.2,fontWeight:'800',color:colors.primarySoft},heading:{fontSize:19,fontWeight:'800',color:colors.textPrimary,marginTop:2},status:{paddingHorizontal:10,paddingVertical:6,borderRadius:18},active:{backgroundColor:colors.successBg},waiting:{backgroundColor:colors.pendingBg},statusText:{fontSize:10,fontWeight:'700',color:colors.textPrimary,textTransform:'capitalize'},content:{padding:spacing.screen,gap:13},hero:{backgroundColor:colors.primary,borderRadius:18,padding:18},product:{fontSize:16,fontWeight:'800',color:'#FFF',marginBottom:15},labelLight:{color:'#D2D5EF',fontSize:10,fontWeight:'700',letterSpacing:.6},big:{fontSize:29,fontWeight:'800',color:'#FFF',marginTop:4},heroLine:{height:1,backgroundColor:'rgba(255,255,255,.18)',marginVertical:13},row:{flexDirection:'row',justifyContent:'space-between',gap:8},heroMetric:{fontSize:14,fontWeight:'700',color:'#FFF',marginTop:4},card:{backgroundColor:colors.surface,borderRadius:15,padding:15,borderWidth:1,borderColor:colors.border},sectionTitle:{fontSize:15,fontWeight:'800',color:colors.textPrimary,marginBottom:9},infoRow:{flexDirection:'row',justifyContent:'space-between',gap:10,paddingVertical:9,borderTopWidth:1,borderColor:colors.border},caption:{fontSize:11,color:colors.textSecondary,lineHeight:17},infoValue:{fontSize:12,fontWeight:'700',color:colors.textPrimary,textAlign:'right',flex:1,textTransform:'capitalize'},scheduleRow:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:10,borderTopWidth:1,borderColor:colors.border},scheduleIcon:{width:30,height:30,borderRadius:10,backgroundColor:'#F0EDFF',alignItems:'center',justifyContent:'center'},rowTitle:{fontSize:12,fontWeight:'700',color:colors.textPrimary,textTransform:'capitalize'},rowAmount:{fontSize:12,fontWeight:'800',color:colors.textPrimary},historyRow:{flexDirection:'row',gap:8,alignItems:'center',paddingVertical:10,borderTopWidth:1,borderColor:colors.border},muted:{color:colors.textSecondary,fontSize:12,lineHeight:18},documentRow:{flexDirection:'row',gap:10,alignItems:'center',paddingVertical:10,borderTopWidth:1,borderColor:colors.border},documentName:{flex:1,color:colors.textPrimary,fontSize:12},center:{flex:1,alignItems:'center',justifyContent:'center',gap:12,backgroundColor:colors.background},link:{color:colors.primary,fontWeight:'700'},modal:{flex:1,backgroundColor:'rgba(0,0,0,.94)',justifyContent:'center',padding:18},close:{position:'absolute',right:18,top:50,zIndex:1},previewTitle:{color:'#FFF',fontWeight:'700',textAlign:'center',marginBottom:12},previewImage:{height:'78%',width:'100%'}});
