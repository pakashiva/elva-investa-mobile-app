import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OtpVisual from '../../components/auth/OtpVisual';
import OtpInput from '../../components/auth/OtpInput';
import KeyboardSafeScroll from '../../components/form/KeyboardSafeScroll';
import PasswordInput from '../../components/auth/PasswordInput';
import {
  MPIN_REQUIREMENT_TEXT,
  PASSWORD_REQUIREMENT_TEXT,
  VERIFY_MOBILE_DEFAULTS,
} from '../../data/verifyMobile';
import { useAuth } from '../../contexts/AuthContext';
import { useOtpCountdown } from '../../hooks/useOtpCountdown';
import {
  completeMpinReset,
  completePasswordReset,
  resendOtp,
  sendOtp,
  verifyOtp,
} from '../../services/otpService';
import { signInWithMobileOrEmail, signOut, setOwnMpin } from '../../services/authService';
import { extendUnlockWindow } from '../../services/sessionUnlockStore';
import {
  getProfileMobileNumber,
  markMobileVerified,
} from '../../services/profileService';
import { completeRegistrationAfterOtp } from '../../services/registrationService';
import { ApiError } from '../../lib/api';
import { loadPendingRegistration } from '../../services/registrationPendingStore';
import { RootStackScreenProps } from '../../navigation/types';
import { OtpMode } from '../../types/otp';
import { maskMobileNumber } from '../../utils/phoneNumber';
import { validateMpin } from '../../utils/validateMpin';
import { validatePasswordComplexity } from '../../utils/validatePassword';
import { authColors } from '../../theme/authColors';
import { colors, spacing } from '../../theme/colors';

const DEFAULT_EXPIRES_IN = VERIFY_MOBILE_DEFAULTS.expiresSeconds;
const RESEND_COOLDOWN_SECONDS = VERIFY_MOBILE_DEFAULTS.resendSeconds;

type Props = RootStackScreenProps<'VerifyMobileNumber'>;

export default function VerifyMobileNumberScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const {
    session,
    clearOtpFlow,
    setBypassMobileVerification,
    markAppUnlocked,
    refreshUnlockWindow,
  } = useAuth();
  const mode: OtpMode = route.params?.mode ?? 'registration';
  const shouldSendOtpOnEntry = route.params?.sendOtp !== false;
  const recoveryEmail = route.params?.email?.trim().toLowerCase() ?? '';
  const routeMobile = route.params?.mobileNumber?.trim() ?? '';
  const recoveryClientCode = route.params?.clientCode?.trim().toUpperCase() ?? '';

  const isForgotMpin = mode === 'forgotMpin';
  const isChangeMpin = mode === 'changeMpin';
  const isForgotPassword = mode === 'forgotPassword';
  const isChangePassword = mode === 'changePassword';
  const isMpinFlow = isForgotMpin || isChangeMpin;
  const isPasswordFlow = isForgotPassword || isChangePassword;
  const isCredentialResetFlow = isMpinFlow || isPasswordFlow;
  const isRegistrationFlow = mode === 'registration';

  const [otp, setOtp] = useState(VERIFY_MOBILE_DEFAULTS.otp);
  const [newMpin, setNewMpin] = useState(VERIFY_MOBILE_DEFAULTS.newMpin);
  const [confirmMpin, setConfirmMpin] = useState(
    VERIFY_MOBILE_DEFAULTS.confirmMpin
  );
  const [newPassword, setNewPassword] = useState(
    VERIFY_MOBILE_DEFAULTS.newPassword
  );
  const [confirmPassword, setConfirmPassword] = useState(
    VERIFY_MOBILE_DEFAULTS.confirmPassword
  );
  const [pendingMobile, setPendingMobile] = useState(routeMobile);
  const [maskedMobile, setMaskedMobile] = useState(
    routeMobile ? maskMobileNumber(routeMobile) : '—'
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(shouldSendOtpOnEntry);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSavingCredential, setIsSavingCredential] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  /** Registration: OTP already consumed — retry only finishes DB writes. */
  const [registrationOtpConsumed, setRegistrationOtpConsumed] = useState(false);
  const [expiresIn, setExpiresIn] = useState(DEFAULT_EXPIRES_IN);
  const initialSendRef = useRef(false);

  const {
    formattedExpires,
    formattedResend,
    canResend,
    isExpired,
    started: otpTimerStarted,
    reset,
  } = useOtpCountdown({
    expiresInSeconds: expiresIn,
    resendCooldownSeconds: RESEND_COOLDOWN_SECONDS,
  });

  const otpOptions = useMemo(
    () =>
      isCredentialResetFlow
        ? { mode, email: recoveryEmail, clientCode: recoveryClientCode || undefined }
        : {
            mode: 'registration' as const,
            userId: session?.user?.id,
            mobileNumber: pendingMobile || routeMobile || undefined,
          },
    [
      isCredentialResetFlow,
      mode,
      pendingMobile,
      recoveryClientCode,
      recoveryEmail,
      routeMobile,
      session?.user?.id,
    ]
  );

  const headerTitle = isChangeMpin
    ? 'Change MPIN'
    : isForgotMpin
      ? 'Reset MPIN'
      : isChangePassword
        ? 'Change Password'
        : isForgotPassword
          ? 'Reset Password'
          : 'Verify Mobile Number';

  const loadMobileNumber = useCallback(async () => {
    if (isCredentialResetFlow) {
      if (!recoveryEmail) {
        setErrorMessage('Registered email address is required.');
      }
      return;
    }

    if (routeMobile) {
      setPendingMobile(routeMobile);
      setMaskedMobile(maskMobileNumber(routeMobile));
      return;
    }

    try {
      const pending = await loadPendingRegistration();
      if (pending?.mobileNumber) {
        setPendingMobile(pending.mobileNumber);
        setMaskedMobile(maskMobileNumber(pending.mobileNumber));
        return;
      }

      const userId = session?.user?.id;
      if (!userId) {
        setErrorMessage(
          'Please complete registration before verifying your mobile number.'
        );
        return;
      }

      const mobileNumber = await getProfileMobileNumber(userId);
      if (!mobileNumber) {
        setErrorMessage('Registered mobile number not found.');
        return;
      }
      setPendingMobile(mobileNumber);
      setMaskedMobile(maskMobileNumber(mobileNumber));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load mobile number.';
      setErrorMessage(message);
    }
  }, [isCredentialResetFlow, recoveryEmail, routeMobile, session?.user?.id]);

  const handleSendOtp = useCallback(async () => {
    if (isCredentialResetFlow && !recoveryEmail) {
      setErrorMessage('Registered email address is required.');
      return;
    }

    if (!isCredentialResetFlow && !isRegistrationFlow && !session?.user?.id) {
      setErrorMessage(
        'Please complete registration before verifying your mobile number.'
      );
      return;
    }

    if (isRegistrationFlow && !(pendingMobile || routeMobile)) {
      setErrorMessage('Registered mobile number not found.');
      return;
    }

    setIsSendingOtp(true);
    setErrorMessage(null);
    setOtpVerified(false);

    try {
      const response = await sendOtp(otpOptions);
      const nextExpiresIn = response.expiresIn ?? DEFAULT_EXPIRES_IN;
      setExpiresIn(nextExpiresIn);
      reset(nextExpiresIn, RESEND_COOLDOWN_SECONDS);
      setStatusMessage(response.message);
      if (response.maskedPhone) {
        setMaskedMobile(response.maskedPhone);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to send OTP.';
      setErrorMessage(message);
    } finally {
      setIsSendingOtp(false);
    }
  }, [
    isCredentialResetFlow,
    isRegistrationFlow,
    otpOptions,
    pendingMobile,
    recoveryEmail,
    reset,
    routeMobile,
    session?.user?.id,
  ]);

  useEffect(() => {
    if (!isRegistrationFlow) {
      return;
    }
    if (session?.customer?.mobileVerified) {
      setBypassMobileVerification(true);
      clearOtpFlow();
      markAppUnlocked();
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }
  }, [
    clearOtpFlow,
    isRegistrationFlow,
    markAppUnlocked,
    navigation,
    session?.customer?.mobileVerified,
    setBypassMobileVerification,
  ]);

  useEffect(() => {
    if (isRegistrationFlow && session?.customer?.mobileVerified) {
      return;
    }

    if (!shouldSendOtpOnEntry || initialSendRef.current) {
      return;
    }

    if (isCredentialResetFlow) {
      if (!recoveryEmail) {
        setIsSendingOtp(false);
        setErrorMessage('Registered email address is required.');
        return;
      }
    } else if (isRegistrationFlow) {
      if (!(pendingMobile || routeMobile)) {
        return;
      }
    } else if (!session?.user?.id && !(pendingMobile || routeMobile)) {
      return;
    }

    initialSendRef.current = true;
    void handleSendOtp();
  }, [
    shouldSendOtpOnEntry,
    handleSendOtp,
    isCredentialResetFlow,
    isRegistrationFlow,
    recoveryEmail,
    session?.user?.id,
    session?.customer?.mobileVerified,
    pendingMobile,
    routeMobile,
  ]);

  const handleResendOtp = async () => {
    if (!canResend || isResendingOtp || isSendingOtp) {
      return;
    }

    setIsResendingOtp(true);
    setErrorMessage(null);
    setOtpVerified(false);
    setRegistrationOtpConsumed(false);

    try {
      const response = await resendOtp(otpOptions);
      const nextExpiresIn = response.expiresIn ?? DEFAULT_EXPIRES_IN;
      setExpiresIn(nextExpiresIn);
      reset(nextExpiresIn, RESEND_COOLDOWN_SECONDS);
      setOtp('');
      setStatusMessage(response.message);
      if (response.maskedPhone) {
        setMaskedMobile(response.maskedPhone);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to resend OTP.';
      setErrorMessage(message);
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (isVerifyingOtp) {
      return;
    }

    if (isExpired && !registrationOtpConsumed) {
      setErrorMessage('OTP has expired. Please resend OTP.');
      return;
    }

    const cleanedOtp = otp.replace(/\D/g, '');
    if (!registrationOtpConsumed && !/^\d{6}$/.test(cleanedOtp)) {
      setErrorMessage('Please enter the 6-digit OTP.');
      return;
    }

    setIsVerifyingOtp(true);
    setErrorMessage(null);

    let otpAlreadyConsumed = registrationOtpConsumed;

    try {
      let statusText = 'OTP verified successfully.';

      if (isCredentialResetFlow) {
        const response = await verifyOtp(cleanedOtp, otpOptions);
        setOtpVerified(true);
        setStatusMessage(response.message);
        return;
      }

      if (!otpAlreadyConsumed) {
        const response = await verifyOtp(cleanedOtp, otpOptions);
        statusText = response.message;
        otpAlreadyConsumed = true;
        setRegistrationOtpConsumed(true);
      }

      const { userId } = await completeRegistrationAfterOtp();

      try {
        await markMobileVerified();
      } catch {
        // Profile may already have mobile_verified = true.
      }

      await extendUnlockWindow(userId);
      setBypassMobileVerification(true);
      clearOtpFlow();
      markAppUnlocked();
      setStatusMessage(statusText);
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'OTP verification failed.';
      if (otpAlreadyConsumed && isRegistrationFlow) {
        const permanentRegistrationError =
          error instanceof ApiError &&
          [400, 403, 409, 422].includes(error.status);
        setErrorMessage(
          permanentRegistrationError
            ? `${message}\n\nYour OTP was accepted, but these registration details were rejected. Go back, correct them, and request a new OTP.`
            : `${message}\n\nYour OTP was already accepted. Tap Verify OTP again to finish saving your account — no new code needed.`
        );
      } else {
        setErrorMessage(message);
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSetMpinAndContinue = async () => {
    if (!isMpinFlow || isSavingCredential) {
      return;
    }

    if (!otpVerified) {
      setErrorMessage('Please verify the OTP before setting a new MPIN.');
      return;
    }

    const mpinError = validateMpin(newMpin);
    if (mpinError) {
      setErrorMessage(mpinError);
      return;
    }

    if (newMpin !== confirmMpin) {
      setErrorMessage('MPINs do not match.');
      return;
    }

    setIsSavingCredential(true);
    setErrorMessage(null);

    try {
      if (isChangeMpin && session?.user?.id) {
        await setOwnMpin(newMpin);
        await extendUnlockWindow(session.user.id);
        await refreshUnlockWindow();
        clearOtpFlow();
        markAppUnlocked();
        setStatusMessage('MPIN updated successfully.');
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
        return;
      }

      await completeMpinReset(recoveryEmail, newMpin);
      clearOtpFlow();

      if (session?.user?.id) {
        await extendUnlockWindow(session.user.id);
        await refreshUnlockWindow();
        markAppUnlocked();
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'SignIn' }],
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to reset MPIN.';
      setErrorMessage(message);
    } finally {
      setIsSavingCredential(false);
    }
  };

  const handleSetPasswordAndContinue = async () => {
    if (!isPasswordFlow || isSavingCredential) {
      return;
    }

    if (!otpVerified) {
      setErrorMessage('Please verify the OTP before setting a new password.');
      return;
    }

    const passwordError = validatePasswordComplexity(newPassword);
    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSavingCredential(true);
    setErrorMessage(null);

    try {
      const response = await completePasswordReset(recoveryEmail, newPassword);
      setBypassMobileVerification(true);
      clearOtpFlow();
      await signInWithMobileOrEmail(recoveryEmail, newPassword, recoveryClientCode);
      await refreshUnlockWindow();
      markAppUnlocked();
      setStatusMessage(response.message);
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to reset password.';
      setErrorMessage(message);
    } finally {
      setIsSavingCredential(false);
    }
  };

  const handleBack = async () => {
    if ((isChangeMpin || isChangePassword) && session) {
      clearOtpFlow();
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
      return;
    }

    if (isForgotMpin && session) {
      clearOtpFlow();
      navigation.reset({
        index: 0,
        routes: [{ name: 'MpinLock' }],
      });
      return;
    }

    if (!isCredentialResetFlow && session) {
      await signOut();
    }

    clearOtpFlow();
    navigation.reset({
      index: 0,
      routes: [{ name: 'SignIn' }],
    });
  };

  const verifyDisabled =
    isVerifyingOtp ||
    isSendingOtp ||
    (!registrationOtpConsumed && isExpired) ||
    (!registrationOtpConsumed && otp.replace(/\D/g, '').length !== 6);

  const mpinContinueDisabled =
    isSavingCredential || !otpVerified || !newMpin || !confirmMpin;
  const passwordContinueDisabled =
    isSavingCredential || !otpVerified || !newPassword || !confirmPassword;

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={handleBack}
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
      </View>

      <KeyboardSafeScroll
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
          <View style={styles.securityBanner}>
            <Ionicons
              name="shield-checkmark"
              size={18}
              color={colors.successText}
            />
            <Text style={styles.securityText}>
              SEBI & RBI compliant safe-encryption protocols are active.
            </Text>
          </View>

          <OtpVisual />

          <Text style={styles.sectionTitle}>OTP Verification</Text>
          <Text style={styles.instruction}>
            {statusMessage
              ? 'We have sent a 6-digit verification code to your registered mobile number '
              : isSendingOtp
                ? 'Sending a 6-digit verification code to your registered mobile number '
                : 'A 6-digit verification code will be sent to your registered mobile number '}
            <Text style={styles.mobileBold}>{maskedMobile}</Text>
          </Text>

          {isSendingOtp ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color={authColors.header} />
              <Text style={styles.inlineLoadingText}>Sending OTP...</Text>
            </View>
          ) : null}

          {statusMessage ? (
            <Text style={styles.statusText}>{statusMessage}</Text>
          ) : null}

          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}

          <OtpInput value={otp} onChange={setOtp} />

          {otpTimerStarted ? (
          <View style={styles.resendRow}>
            <Ionicons
              name="time-outline"
              size={15}
              color={authColors.textMuted}
            />
            <Text style={styles.resendCountdown}>
              {isExpired ? (
                <Text style={styles.expiredText}>OTP expired</Text>
              ) : (
                <>
                  OTP expires in{' '}
                  <Text style={styles.resendBold}>{formattedExpires}</Text>
                </>
              )}
            </Text>
          </View>
          ) : null}

          <View style={styles.resendPromptRow}>
            <Text style={styles.resendPrompt}>Didn&apos;t receive the code? </Text>
            <TouchableOpacity
              activeOpacity={canResend && !isResendingOtp ? 0.7 : 1}
              onPress={handleResendOtp}
              disabled={!canResend || isResendingOtp || isSendingOtp}
            >
              <Text
                style={[
                  styles.resendLink,
                  (!canResend || isResendingOtp || isSendingOtp) &&
                    styles.resendLinkDisabled,
                ]}
              >
                {isResendingOtp
                  ? 'Resending...'
                  : canResend
                    ? 'Resend OTP'
                    : `Resend in ${formattedResend}`}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              verifyDisabled && styles.primaryBtnDisabled,
            ]}
            activeOpacity={0.85}
            onPress={handleVerifyOtp}
            disabled={verifyDisabled}
          >
            {isVerifyingOtp ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Verify OTP</Text>
            )}
          </TouchableOpacity>

          {isMpinFlow && otpVerified ? (
            <View style={styles.passwordSection}>
              <Text style={styles.passwordHeading}>
                {isChangeMpin ? 'Set New MPIN' : 'Set Your MPIN'}
              </Text>

              <PasswordInput
                label="New MPIN"
                required
                value={newMpin}
                onChangeText={(text) =>
                  setNewMpin(text.replace(/\D/g, '').slice(0, 4))
                }
                keyboardType="number-pad"
                maxLength={4}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />

              <PasswordInput
                label="Confirm MPIN"
                required
                value={confirmMpin}
                onChangeText={(text) =>
                  setConfirmMpin(text.replace(/\D/g, '').slice(0, 4))
                }
                keyboardType="number-pad"
                maxLength={4}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />

              <Text style={styles.passwordHint}>{MPIN_REQUIREMENT_TEXT}</Text>

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  mpinContinueDisabled && styles.primaryBtnDisabled,
                ]}
                activeOpacity={0.85}
                onPress={handleSetMpinAndContinue}
                disabled={mpinContinueDisabled}
              >
                {isSavingCredential ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {isChangeMpin ? 'Update MPIN' : 'Set MPIN & Continue'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          {isPasswordFlow && otpVerified ? (
            <View style={styles.passwordSection}>
              <Text style={styles.passwordHeading}>
                {isChangePassword ? 'Set New Password' : 'Set Your Password'}
              </Text>

              <PasswordInput
                label="New Password"
                required
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />

              <PasswordInput
                label="Confirm Password"
                required
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />

              <Text style={styles.passwordHint}>
                {PASSWORD_REQUIREMENT_TEXT}
              </Text>

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  passwordContinueDisabled && styles.primaryBtnDisabled,
                ]}
                activeOpacity={0.85}
                onPress={handleSetPasswordAndContinue}
                disabled={passwordContinueDisabled}
              >
                {isSavingCredential ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {isChangePassword
                      ? 'Update Password'
                      : 'Set Password & Continue'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
      </KeyboardSafeScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: authColors.header,
    paddingHorizontal: spacing.screen,
    paddingBottom: 14,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: spacing.screen,
    paddingTop: 16,
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: '#B7E4C7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 22,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.successText,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: authColors.header,
    textAlign: 'center',
    marginBottom: 10,
  },
  instruction: {
    fontSize: 14,
    lineHeight: 21,
    color: authColors.textMuted,
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  mobileBold: {
    fontWeight: '700',
    color: authColors.textDark,
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  inlineLoadingText: {
    fontSize: 13,
    color: authColors.textMuted,
  },
  statusText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.successText,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 12,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  resendCountdown: {
    fontSize: 13,
    color: authColors.textMuted,
  },
  expiredText: {
    fontWeight: '700',
    color: '#FF3B30',
  },
  resendBold: {
    fontWeight: '700',
    color: authColors.textDark,
  },
  resendPromptRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  resendPrompt: {
    fontSize: 13,
    color: authColors.textMuted,
  },
  resendLink: {
    fontSize: 13,
    fontWeight: '700',
    color: authColors.gold,
    textDecorationLine: 'underline',
  },
  resendLinkDisabled: {
    opacity: 0.55,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: authColors.header,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  primaryBtnDisabled: {
    opacity: 0.65,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  passwordSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: authColors.divider,
    paddingTop: 24,
  },
  passwordHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: authColors.header,
    marginBottom: 18,
  },
  passwordHint: {
    fontSize: 12,
    lineHeight: 18,
    color: authColors.textMuted,
    marginBottom: 20,
  },
});
