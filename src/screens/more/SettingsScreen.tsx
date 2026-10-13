import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { SETTINGS_LEGAL_ITEMS } from '../../data/settings';
import { navigationRef } from '../../navigation/navigationRef';
import { MoreStackScreenProps } from '../../navigation/types';
import { colors, spacing } from '../../theme/colors';

type Props = MoreStackScreenProps<'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { session, clearOtpFlow } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [isStartingMpinChange, setIsStartingMpinChange] = useState(false);
  const [isStartingPasswordChange, setIsStartingPasswordChange] =
    useState(false);

  const startOtpChange = async (
    mode: 'changeMpin' | 'changePassword',
    setLoading: (value: boolean) => void,
    errorTitle: string
  ) => {
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      Alert.alert(
        'Email required',
        'Your account email is missing. Please sign in again and try once more.'
      );
      return;
    }

    setLoading(true);
    clearOtpFlow();

    try {
      if (!navigationRef.isReady()) {
        throw new Error('Navigation is not ready. Please try again.');
      }
      navigationRef.navigate('VerifyMobileNumber', {
        mode,
        email,
        sendOtp: true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Unable to start ${errorTitle}.`;
      Alert.alert('Unable to continue', message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeMpin = () =>
    startOtpChange('changeMpin', setIsStartingMpinChange, 'MPIN change');

  const handleChangePassword = () =>
    startOtpChange(
      'changePassword',
      setIsStartingPasswordChange,
      'password change'
    );

  const handleLegalPress = (id: (typeof SETTINGS_LEGAL_ITEMS)[number]['id']) => {
    navigation.navigate('LegalDocument', { documentId: id });
  };

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>
            Manage your account preferences and view information.
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeading}>SECURITY</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={colors.primarySoft}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Change MPIN</Text>
              <Text style={styles.rowSubtitle}>
                Verify mobile OTP, then set a new 4-digit MPIN
              </Text>
            </View>
            <TouchableOpacity
              style={styles.updateBtn}
              activeOpacity={0.8}
              onPress={handleChangeMpin}
              disabled={isStartingMpinChange}
            >
              {isStartingMpinChange ? (
                <ActivityIndicator size="small" color={colors.primarySoft} />
              ) : (
                <Text style={styles.updateBtnText}>Update</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Ionicons
                name="key-outline"
                size={18}
                color={colors.primarySoft}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Change Password</Text>
              <Text style={styles.rowSubtitle}>
                Verify mobile OTP, then set a new sign-in password
              </Text>
            </View>
            <TouchableOpacity
              style={styles.updateBtn}
              activeOpacity={0.8}
              onPress={handleChangePassword}
              disabled={isStartingPasswordChange}
            >
              {isStartingPasswordChange ? (
                <ActivityIndicator size="small" color={colors.primarySoft} />
              ) : (
                <Text style={styles.updateBtnText}>Update</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionHeading}>PREFERENCES</Text>
        <TouchableOpacity
          style={[styles.card, styles.legalCard]}
          activeOpacity={0.75}
          onPress={() => navigation.navigate('AccountCapabilities')}
        >
          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Ionicons name="options-outline" size={18} color={colors.primarySoft} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Account capabilities</Text>
              <Text style={styles.rowSubtitle}>Choose investing, borrowing, or both</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Ionicons
                name="notifications-outline"
                size={18}
                color={colors.primarySoft}
              />
            </View>

            
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Push Notifications</Text>
              <Text style={styles.rowSubtitle}>
                Receive updates about your fund management
              </Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: '#D0D5DD', true: colors.primarySoft }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#D0D5DD"
            />
          </View>
        </View>

        <Text style={styles.sectionHeading}>LEGAL & INFORMATION</Text>
        {SETTINGS_LEGAL_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.card, styles.legalCard]}
            activeOpacity={0.75}
            onPress={() => handleLegalPress(item.id)}
          >
            <View style={styles.row}>
              <View style={styles.iconCircle}>
                <Ionicons name={item.icon} size={18} color={colors.primarySoft} />
              </View>
              <Text style={[styles.rowTitle, styles.legalTitle]}>
                {item.label}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textMuted}
              />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.screen,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerSpacer: {
    width: 36,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: 18,
    paddingBottom: 28,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.textSecondary,
    marginBottom: 10,
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  legalCard: {
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0EBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  legalTitle: {
    flex: 1,
  },
  rowSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  updateBtn: {
    borderWidth: 1.5,
    borderColor: colors.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  updateBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primarySoft,
  },
});
