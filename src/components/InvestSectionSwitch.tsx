import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  active: 'investments' | 'withdrawals';
  onInvestments: () => void;
  onWithdrawals: () => void;
};

export default function InvestSectionSwitch({ active, onInvestments, onWithdrawals }: Props) {
  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: active === 'investments' }}
        style={[styles.option, active === 'investments' && styles.selected]}
        onPress={onInvestments}
      >
        <Text style={[styles.label, active === 'investments' && styles.selectedLabel]}>Investments</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: active === 'withdrawals' }}
        style={[styles.option, active === 'withdrawals' && styles.selected]}
        onPress={onWithdrawals}
      >
        <Text style={[styles.label, active === 'withdrawals' && styles.selectedLabel]}>Withdrawals</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', padding: 4, marginBottom: 14, borderRadius: 12, backgroundColor: '#EEF1F7' },
  option: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 38, paddingHorizontal: 10, borderRadius: 9 },
  selected: { backgroundColor: colors.surface, shadowColor: '#16213E', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  selectedLabel: { color: colors.primary, fontWeight: '700' },
});
