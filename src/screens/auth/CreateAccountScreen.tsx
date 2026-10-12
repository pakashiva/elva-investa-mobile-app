import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AccountTypeSelector from '../../components/bank/AccountTypeSelector';
import RegistrationDateField from '../../components/registration/RegistrationDateField';
import RegistrationSectionHeader from '../../components/registration/RegistrationSectionHeader';
import RegistrationTextField from '../../components/registration/RegistrationTextField';
import FormSelectField from '../../components/form/FormSelectField';
import FormCheckbox from '../../components/form/FormCheckbox';
import KeyboardSafeScroll from '../../components/form/KeyboardSafeScroll';
import {
  REGISTRATION_AUTHORIZATION_TEXT,
  REGISTRATION_FORM_DEFAULTS,
  REGISTRATION_MPIN_HINT,
  REGISTRATION_PASSWORD_HINT,
  REGISTRATION_SECURITY_TEXT,
  RELATIONSHIP_OPTIONS,
} from '../../data/registrationForm';
import PasswordInput from '../../components/auth/PasswordInput';
import { beginRegistration } from '../../services/registrationService';
import { ApiError } from '../../lib/api';
import { lookupClientCode } from '../../services/clientLookupService';
import { useAuth } from '../../contexts/AuthContext';
import { detectBankNameFromIfsc } from '../../utils/bankName';
import { RootStackScreenProps } from '../../navigation/types';
import { RegistrationFormErrors } from '../../types/registrationForm';
import { authColors } from '../../theme/authColors';
import { colors, spacing } from '../../theme/colors';
import {
  hasFormErrors,
  validateRegistrationForm,
} from '../../utils/validateRegistrationForm';

type Props = RootStackScreenProps<'CreateAccount'>;

function digitsUpTo(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

function mobileDigitsUpToTen(value: string): string {
  const digits = value.replace(/\D/g, '');
  const localDigits =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits;
  return localDigits.slice(0, 10);
}

function identifierUpTo(value: string, maxLength: number): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, maxLength);
}

export default function CreateAccountScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const {
    setOtpFlow,
    clearOtpFlow,
    setBypassMobileVerification,
  } = useAuth();
  const [form, setForm] = useState(REGISTRATION_FORM_DEFAULTS);
  const [errors, setErrors] = useState<RegistrationFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientName, setClientName] = useState<string | null>(null);
  const [isLookingUpClient, setIsLookingUpClient] = useState(false);
  const submitLock = useRef(false);

  useEffect(() => {
    const code = form.clientCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,20}$/.test(code)) {
      setClientName(null);
      setIsLookingUpClient(false);
      return;
    }

    let cancelled = false;
    setClientName(null);
    setIsLookingUpClient(true);
    const timer = setTimeout(() => {
      void lookupClientCode(code)
        .then((client) => {
          if (cancelled) {
            return;
          }
          setClientName(client.name);
          setErrors((prev) => {
            if (!prev.clientCode) {
              return prev;
            }
            const next = { ...prev };
            delete next.clientCode;
            return next;
          });
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          setClientName(null);
          setErrors((prev) => ({
            ...prev,
            clientCode:
              error instanceof Error
                ? error.message
                : 'That client code was not found.',
          }));
        })
        .finally(() => {
          if (!cancelled) {
            setIsLookingUpClient(false);
          }
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.clientCode]);

  const updateField = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) => {
    if (isSubmitting) {
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSubmit = async () => {
    if (submitLock.current) {
      return;
    }

    const nextErrors = validateRegistrationForm(form);
    setErrors(nextErrors);

    if (hasFormErrors(nextErrors)) {
      Alert.alert(
        'Check your form',
        'Please complete all required fields and fix any errors before submitting.'
      );
      return;
    }

    submitLock.current = true;
    setIsSubmitting(true);

    try {
      const result = await beginRegistration(form);
      setBypassMobileVerification(false);
      setOtpFlow('registration');
      navigation.replace('VerifyMobileNumber', {
        mode: 'registration',
        sendOtp: true,
        mobileNumber: result.mobileNumber,
      });
    } catch (error) {
      clearOtpFlow();
      const message =
        error instanceof Error
          ? error.message
          : 'Registration failed. Please try again.';
      if (
        error instanceof ApiError &&
        [400, 403, 404].includes(error.status)
      ) {
        setErrors((previous) => ({ ...previous, clientCode: message }));
      }
      Alert.alert('Registration failed', message);
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Account</Text>
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
            <Text style={styles.securityText}>{REGISTRATION_SECURITY_TEXT}</Text>
          </View>

          <RegistrationSectionHeader
            number={1}
            title="Your trader"
            description="Enter the client code given by your trader. You will stay with this client."
          />

          <RegistrationTextField
            label="Client Code"
            required
            value={form.clientCode}
            onChangeText={(text) =>
              updateField('clientCode', text.toUpperCase().replace(/[^A-Z0-9]/g, ''))
            }
            error={errors.clientCode}
            autoCapitalize="characters"
            placeholder="Example: VTINVEST"
          />
          {isLookingUpClient ? (
            <Text style={styles.helperText}>Checking client code…</Text>
          ) : clientName ? (
            <Text style={styles.helperText}>Joining {clientName}</Text>
          ) : null}

          <RegistrationSectionHeader
            number={2}
            title="Personal Details"
            description="Enter your legal details as per official documents"
          />

          <RegistrationTextField
            label="Full Name"
            required
            value={form.fullName}
            onChangeText={(text) => updateField('fullName', text)}
            error={errors.fullName}
            autoCapitalize="words"
          />
          <RegistrationTextField
            label="Mobile Number"
            required
            value={form.mobileNumber}
            onChangeText={(text) =>
              updateField('mobileNumber', mobileDigitsUpToTen(text))
            }
            error={errors.mobileNumber}
            keyboardType="phone-pad"
          />
          <RegistrationTextField
            label="Email Address"
            required
            value={form.emailAddress}
            onChangeText={(text) => updateField('emailAddress', text)}
            error={errors.emailAddress}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <RegistrationDateField
            label="Date of Birth"
            required
            value={form.dateOfBirth}
            onChange={(value) => updateField('dateOfBirth', value)}
            error={errors.dateOfBirth}
          />
          <RegistrationTextField
            label="Full Address"
            required
            value={form.address}
            onChangeText={(text) => updateField('address', text)}
            error={errors.address}
            placeholder="House / street, area, city, state, PIN code"
            multiline
          />

          <RegistrationSectionHeader
            number={3}
            title="KYC Documents Verification"
            description="Enter Aadhaar and PAN numbers for compliance"
          />

          <RegistrationTextField
            label="Aadhaar Card Number"
            required
            value={form.aadhaarNumber}
            onChangeText={(text) =>
              updateField('aadhaarNumber', digitsUpTo(text, 12))
            }
            error={errors.aadhaarNumber}
            keyboardType="number-pad"
          />

          <RegistrationTextField
            label="PAN Card Number"
            required
            value={form.panNumber}
            onChangeText={(text) =>
              updateField('panNumber', identifierUpTo(text, 10))
            }
            error={errors.panNumber}
            autoCapitalize="characters"
          />

          <RegistrationSectionHeader
            number={4}
            title="Bank Account Details"
            description="For easy deposits and secure payouts"
          />

          <RegistrationTextField
            label="Account Holder Name"
            required
            value={form.accountHolderName}
            onChangeText={(text) => updateField('accountHolderName', text)}
            error={errors.accountHolderName}
            autoCapitalize="words"
          />
          <RegistrationTextField
            label="Account Number"
            required
            value={form.accountNumber}
            onChangeText={(text) =>
              updateField('accountNumber', digitsUpTo(text, 18))
            }
            error={errors.accountNumber}
            keyboardType="number-pad"
          />
          <RegistrationTextField
            label="Confirm Account Number"
            required
            value={form.confirmAccountNumber}
            onChangeText={(text) =>
              updateField('confirmAccountNumber', digitsUpTo(text, 18))
            }
            error={errors.confirmAccountNumber}
            keyboardType="number-pad"
          />
          <RegistrationTextField
            label="IFSC Code"
            required
            value={form.ifscCode}
            onChangeText={(text) => {
              if (isSubmitting) {
                return;
              }
              const nextIfsc = identifierUpTo(text, 11);
              const detectedBank = detectBankNameFromIfsc(nextIfsc);
              setForm((prev) => ({
                ...prev,
                ifscCode: nextIfsc,
                ...(detectedBank ? { bankName: detectedBank } : {}),
              }));
              if (errors.ifscCode) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.ifscCode;
                  return next;
                });
              }
              if (detectedBank && errors.bankName) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.bankName;
                  return next;
                });
              }
            }}
            error={errors.ifscCode}
            autoCapitalize="characters"
          />

          <AccountTypeSelector
            value={form.accountType}
            onChange={(type) => updateField('accountType', type)}
          />

          <RegistrationTextField
            label="Bank Name"
            required
            value={form.bankName}
            onChangeText={(text) => updateField('bankName', text)}
            placeholder="Auto-detected from IFSC or enter manually"
            error={errors.bankName}
          />

          <RegistrationTextField
            label="Branch Name"
            required
            value={form.branchName}
            onChangeText={(text) => updateField('branchName', text)}
            placeholder="Enter branch name"
            error={errors.branchName}
            autoCapitalize="words"
          />

          <RegistrationSectionHeader
            number={5}
            title="Nominee Details"
            description="Nominate a successor for your digital assets"
          />

          <RegistrationTextField
            label="Nominee Name"
            required
            value={form.nomineeName}
            onChangeText={(text) => updateField('nomineeName', text)}
            error={errors.nomineeName}
            autoCapitalize="words"
          />

          <FormSelectField
            label="Relationship"
            required
            placeholder="Select relationship"
            value={form.relationship}
            options={RELATIONSHIP_OPTIONS}
            onChange={(id) => updateField('relationship', id)}
          />
          {errors.relationship ? (
            <Text style={styles.fieldError}>{errors.relationship}</Text>
          ) : null}

          <RegistrationTextField
            label="Nominee Aadhaar Number"
            required
            value={form.nomineeAadhaar}
            onChangeText={(text) =>
              updateField('nomineeAadhaar', digitsUpTo(text, 12))
            }
            error={errors.nomineeAadhaar}
            keyboardType="number-pad"
          />
          <RegistrationTextField
            label="Nominee's Mobile"
            required
            value={form.nomineeMobile}
            onChangeText={(text) =>
              updateField('nomineeMobile', mobileDigitsUpToTen(text))
            }
            error={errors.nomineeMobile}
            keyboardType="phone-pad"
          />
          <RegistrationTextField
            label="Nominee's PAN"
            required
            value={form.nomineePan}
            onChangeText={(text) =>
              updateField('nomineePan', identifierUpTo(text, 10))
            }
            error={errors.nomineePan}
            autoCapitalize="characters"
          />

          <RegistrationSectionHeader
            number={6}
            title="Set Password & MPIN"
            description="Password for sign-in; MPIN to unlock the app on this device"
          />

          <PasswordInput
            label="Password"
            required
            value={form.password}
            onChangeText={(text) => updateField('password', text)}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          {errors.password ? (
            <Text style={styles.fieldError}>{errors.password}</Text>
          ) : null}

          <PasswordInput
            label="Confirm Password"
            required
            value={form.confirmPassword}
            onChangeText={(text) => updateField('confirmPassword', text)}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          {errors.confirmPassword ? (
            <Text style={styles.fieldError}>{errors.confirmPassword}</Text>
          ) : null}

          <Text style={styles.passwordHint}>{REGISTRATION_PASSWORD_HINT}</Text>

          <PasswordInput
            label="MPIN"
            required
            value={form.mpin}
            onChangeText={(text) =>
              updateField('mpin', text.replace(/\D/g, '').slice(0, 4))
            }
            keyboardType="number-pad"
            maxLength={4}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          {errors.mpin ? (
            <Text style={styles.fieldError}>{errors.mpin}</Text>
          ) : null}

          <PasswordInput
            label="Confirm MPIN"
            required
            value={form.confirmMpin}
            onChangeText={(text) =>
              updateField('confirmMpin', text.replace(/\D/g, '').slice(0, 4))
            }
            keyboardType="number-pad"
            maxLength={4}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
          {errors.confirmMpin ? (
            <Text style={styles.fieldError}>{errors.confirmMpin}</Text>
          ) : null}

          <Text style={styles.passwordHint}>{REGISTRATION_MPIN_HINT}</Text>

          <FormCheckbox
            checked={form.authorized}
            onChange={(next) => updateField('authorized', next)}
            checkedColor={authColors.header}
            label={REGISTRATION_AUTHORIZATION_TEXT}
          />
          {errors.authorized ? (
            <Text style={styles.fieldError}>{errors.authorized}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Submit Registration</Text>
            )}
          </TouchableOpacity>
      </KeyboardSafeScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
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
  fieldError: {
    marginTop: -10,
    marginBottom: 12,
    fontSize: 12,
    color: '#FF3B30',
  },
  helperText: {
    marginTop: -8,
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 18,
    color: colors.successText,
    fontWeight: '600',
  },
  passwordHint: {
    fontSize: 12,
    lineHeight: 18,
    color: authColors.textMuted,
    marginTop: -8,
    marginBottom: 16,
  },
  submitBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: authColors.header,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
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
