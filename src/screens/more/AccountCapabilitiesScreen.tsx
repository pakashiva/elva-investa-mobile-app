import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest } from '../../lib/api';
import { MoreStackScreenProps } from '../../navigation/types';
import { persistSession } from '../../services/sessionStore';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing } from '../../theme/colors';

type Props = MoreStackScreenProps<'AccountCapabilities'>;
type Capabilities = { enabledModules: string[]; customerType: 'investor'|'borrower'|'both'; hasBorrowerAccount: boolean; hasOpenLoan: boolean };
const choices = [
  { value: 'investor', title: 'Invest', detail: 'Invest and manage payouts', icon: 'trending-up-outline' },
  { value: 'borrower', title: 'Borrow', detail: 'Apply for loans and track repayments', icon: 'cash-outline' },
  { value: 'both', title: 'Both', detail: 'Use investing and borrowing', icon: 'swap-horizontal-outline' },
] as const;

export default function AccountCapabilitiesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [data, setData] = useState<Capabilities | null>(null);
  const [selected, setSelected] = useState<Capabilities['customerType']>('investor');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try {
      const result = await apiRequest<{capabilities: Capabilities}>('/api/mobile/account-capabilities');
      setData(result.capabilities);
      setSelected(result.capabilities.customerType);
    } catch (error) {
      Alert.alert('Unable to load account options', error instanceof Error ? error.message : 'Please try again.');
    } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const available = (type: Capabilities['customerType']) => {
    if (!data) return false;
    return (type === 'borrower' || type === 'both' ? data.enabledModules.includes('borrow') : true)
      && (type === 'investor' || type === 'both' ? data.enabledModules.includes('invest') : true);
  };

  const save = async () => {
    if (!data || !session || selected === data.customerType) { navigation.goBack(); return; }
    if (data.hasOpenLoan && ['borrower','both'].includes(data.customerType) && !['borrower','both'].includes(selected)) {
      Alert.alert('Open loan', 'Borrowing cannot be disabled while you have a pending or active loan.'); return;
    }
    setSaving(true);
    try {
      const updated = await apiRequest<Capabilities>('/api/mobile/account-capabilities', { method: 'POST', body: JSON.stringify({ customerType: selected }) });
      await persistSession(session.access_token, { ...session.customer, customerType: updated.customerType, enabledModules: updated.enabledModules, hasBorrowerAccount: updated.hasBorrowerAccount });
      Alert.alert('Account updated', 'Your account capabilities have been updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error) {
      Alert.alert('Unable to update account', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSaving(false); }
  };

  return <View style={[styles.safe, { paddingTop: insets.top }]}>
    <View style={styles.header}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={22} color={colors.textPrimary}/></TouchableOpacity>
      <Text style={styles.heading}>Account capabilities</Text><View style={styles.spacer}/>
    </View>
    {loading ? <ActivityIndicator style={styles.loader} color={colors.primarySoft}/> : <View style={styles.body}>
      <Text style={styles.intro}>Choose the services you want to use. Options depend on what your client offers.</Text>
      {choices.map((choice) => {
        const value = choice.value as Capabilities['customerType'];
        const enabled = available(value);
        return <TouchableOpacity key={value} disabled={!enabled || saving} onPress={() => setSelected(value)} style={[styles.option, selected === value && styles.selected, !enabled && styles.disabled]}>
          <View style={styles.icon}><Ionicons name={choice.icon} size={20} color={enabled ? colors.primarySoft : colors.textMuted}/></View>
          <View style={styles.copy}><Text style={styles.title}>{choice.title}</Text><Text style={styles.detail}>{choice.detail}</Text>{!enabled && <Text style={styles.unavailable}>Not available for your client</Text>}</View>
          <Ionicons name={selected === value ? 'radio-button-on' : 'radio-button-off'} size={21} color={selected === value ? colors.primarySoft : colors.textMuted}/>
        </TouchableOpacity>;
      })}
      {data?.hasOpenLoan ? <Text style={styles.note}>Borrowing stays enabled while a loan is pending or active.</Text> : null}
      <TouchableOpacity disabled={saving || selected === data?.customerType} onPress={save} style={[styles.save, (saving || selected === data?.customerType) && styles.saveDisabled]}>
        {saving ? <ActivityIndicator color="#fff"/> : <Text style={styles.saveText}>Save changes</Text>}
      </TouchableOpacity>
    </View>}
  </View>;
}

const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:colors.background},header:{height:58,flexDirection:'row',alignItems:'center',paddingHorizontal:spacing.screen,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border,backgroundColor:colors.surface},back:{width:36,height:36,alignItems:'center',justifyContent:'center'},heading:{flex:1,textAlign:'center',fontSize:17,fontWeight:'700',color:colors.textPrimary},spacer:{width:36},body:{padding:spacing.screen},intro:{fontSize:14,lineHeight:21,color:colors.textSecondary,marginBottom:18},option:{flexDirection:'row',alignItems:'center',gap:12,padding:14,marginBottom:12,borderRadius:14,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},selected:{borderColor:colors.primarySoft,backgroundColor:'#F7F5FF'},disabled:{opacity:0.5},icon:{width:42,height:42,borderRadius:21,backgroundColor:'#F0EBFF',alignItems:'center',justifyContent:'center'},copy:{flex:1},title:{fontSize:15,fontWeight:'700',color:colors.textPrimary},detail:{fontSize:12,color:colors.textSecondary,marginTop:3},unavailable:{fontSize:11,color:colors.textMuted,marginTop:4},note:{fontSize:12,lineHeight:18,color:colors.textSecondary,marginVertical:4},save:{height:50,borderRadius:12,backgroundColor:colors.primarySoft,alignItems:'center',justifyContent:'center',marginTop:16},saveDisabled:{opacity:0.55},saveText:{fontSize:15,fontWeight:'700',color:'#fff'},loader:{marginTop:60}});
