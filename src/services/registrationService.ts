import { parseDateOfBirth } from '../utils/formatDate';
import { RegistrationFormValues } from '../types/registrationForm';
import { CustomerPayload } from '../types/auth';
import { normalizeMobileDigits } from '../utils/indianValidators';
import { apiRequest } from '../lib/api';
import { lookupClientCode } from './clientLookupService';
import { persistSession, getStoredSession } from './sessionStore';
import { saveMpin } from './mpinStore';
import {
  clearPendingRegistration,
  loadPendingRegistration,
  savePendingRegistration,
} from './registrationPendingStore';

export type RegistrationResult = {
  userId: string;
  mobileNumber: string;
};

function toIsoDate(dateOfBirth: string): string {
  const date = parseDateOfBirth(dateOfBirth);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function splitIndianAddress(address: string): {
  city: string;
  state: string;
  pinCode: string;
} {
  const pinCode = address.match(/(\d{6})\s*$/)?.[1] ?? '';
  const withoutPin = address.replace(/,?\s*\d{6}\s*$/, '').trim();
  const parts = withoutPin
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const state = parts.length >= 2 ? parts[parts.length - 1] : '';
  const city =
    parts.length >= 2
      ? parts[parts.length - 2]
      : parts.length === 1
        ? parts[0]
        : '';
  return { city, state, pinCode };
}

function buildRegisterBody(form: RegistrationFormValues) {
  const mobileNumber = normalizeMobileDigits(form.mobileNumber);
  const emailAddress = form.emailAddress.trim().toLowerCase();
  const { city, state, pinCode } = splitIndianAddress(form.address);

  return {
    clientCode: form.clientCode.trim().toUpperCase(),
    customerType: form.customerType,
    fullName: form.fullName.trim(),
    emailAddress,
    mobileNumber,
    dateOfBirth: toIsoDate(form.dateOfBirth),
    address: form.address.trim(),
    city,
    state,
    pinCode,
    aadhaarNumber: form.aadhaarNumber.replace(/\D/g, ''),
    panNumber: form.panNumber.trim().toUpperCase(),
    accountHolderName: form.accountHolderName.trim(),
    accountNumber: form.accountNumber.replace(/\D/g, ''),
    ifscCode: form.ifscCode.trim().toUpperCase(),
    bankName: form.bankName.trim(),
    accountType: form.accountType,
    nomineeName: form.nomineeName.trim(),
    relationship: form.relationship,
    nomineeAadhaar: form.nomineeAadhaar.replace(/\D/g, ''),
    nomineeMobile: normalizeMobileDigits(form.nomineeMobile),
    nomineePan: form.nomineePan.trim().toUpperCase(),
    password: form.password,
    authorized: form.authorized,
  };
}

/**
 * Stores the form locally and sends the user to OTP.
 * The customer row is created only after OTP succeeds.
 */
export async function beginRegistration(
  form: RegistrationFormValues
): Promise<RegistrationResult> {
  const mobileNumber = normalizeMobileDigits(form.mobileNumber);
  const emailAddress = form.emailAddress.trim().toLowerCase();

  // Do not persist or advance to OTP until the selected trader is confirmed.
  // Clear any earlier draft so an invalid attempt cannot be resumed by mistake.
  await clearPendingRegistration();
  await lookupClientCode(form.clientCode);
  await savePendingRegistration({
    ...form,
    clientCode: form.clientCode.trim().toUpperCase(),
    mobileNumber,
    emailAddress,
  });

  return { userId: '', mobileNumber };
}

/** @deprecated Use beginRegistration + completeRegistrationAfterOtp */
export async function registerUser(
  form: RegistrationFormValues
): Promise<RegistrationResult> {
  return beginRegistration(form);
}

export async function completeRegistrationAfterOtp(
  _userId?: string
): Promise<{ userId: string }> {
  const form = await loadPendingRegistration();

  if (form) {
    let session = await getStoredSession();
    const samePendingCustomer = Boolean(
      session &&
        session.customer.emailAddress.trim().toLowerCase() ===
          form.emailAddress.trim().toLowerCase() &&
        normalizeMobileDigits(session.customer.mobileNumber) ===
          normalizeMobileDigits(form.mobileNumber) &&
        session.customer.clientCode.trim().toUpperCase() ===
          form.clientCode.trim().toUpperCase()
    );

    // If account creation succeeded but a later local step failed, resume with
    // the stored session instead of POSTing /register a second time.
    if (!session || !samePendingCustomer) {
      const data = await apiRequest<{
        token: string;
        customer: CustomerPayload;
      }>('/api/mobile/auth/register', {
        method: 'POST',
        auth: false,
        body: JSON.stringify(buildRegisterBody(form)),
      });

      session = await persistSession(data.token, data.customer);
    }

    if (!session) {
      throw new Error('Could not restore your registration. Please try again.');
    }

    await saveMpin({
      customerId: session.customer.id,
      email: form.emailAddress,
      mpin: form.mpin,
    });
    await clearPendingRegistration();

    const verified = await apiRequest<{ customer: CustomerPayload }>(
      '/api/mobile/auth/verify-mobile',
      { method: 'POST' }
    );
    await persistSession(session.access_token, {
      ...(verified.customer ?? session.customer),
      mobileVerified: true,
    });

    return { userId: session.customer.id };
  }

  const session = await getStoredSession();
  if (!session?.customer?.id) {
    throw new Error(
      'Registration details were lost. Please register again from the start.'
    );
  }

  const verified = await apiRequest<{ customer: CustomerPayload }>(
    '/api/mobile/auth/verify-mobile',
    { method: 'POST' }
  );
  if (verified.customer) {
    await persistSession(session.access_token, verified.customer);
  }

  return { userId: session.customer.id };
}




