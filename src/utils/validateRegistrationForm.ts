import {
  RegistrationFormErrors,
  RegistrationFormValues,
} from '../types/registrationForm';
import {
  validateAadhaarNumber,
  validateBankAccountNumber,
  validateEmailAddress,
  validateIfscCode,
  validateIndianMobile,
  validatePanNumber,
} from './indianValidators';
import { validateMpin } from './validateMpin';
import { validatePasswordComplexity } from './validatePassword';

function isEmpty(value: string): boolean {
  return !value.trim();
}

export function validateRegistrationForm(
  values: RegistrationFormValues
): RegistrationFormErrors {
  const errors: RegistrationFormErrors = {};

  const clientCode = values.clientCode.trim().toUpperCase();
  if (isEmpty(clientCode)) {
    errors.clientCode = 'Client code is required';
  } else if (!/^[A-Z0-9]{3,20}$/.test(clientCode)) {
    errors.clientCode = 'Enter the 3–20 character client code from your trader';
  }

  if (isEmpty(values.fullName)) errors.fullName = 'Full name is required';

  if (isEmpty(values.mobileNumber)) {
    errors.mobileNumber = 'Mobile number is required';
  } else {
    const mobileError = validateIndianMobile(values.mobileNumber);
    if (mobileError) errors.mobileNumber = mobileError;
  }

  if (isEmpty(values.emailAddress)) {
    errors.emailAddress = 'Email address is required';
  } else {
    const emailError = validateEmailAddress(values.emailAddress);
    if (emailError) errors.emailAddress = emailError;
  }

  if (isEmpty(values.dateOfBirth)) errors.dateOfBirth = 'Date of birth is required';
  if (isEmpty(values.address)) errors.address = 'Full address is required';

  const includesInvest = values.customerType === 'investor' || values.customerType === 'both';
  if (isEmpty(values.aadhaarNumber)) {
    errors.aadhaarNumber = 'Aadhaar card number is required';
  } else if (values.aadhaarNumber) {
    const aadhaarError = validateAadhaarNumber(values.aadhaarNumber);
    if (aadhaarError) errors.aadhaarNumber = aadhaarError;
  }

  if (isEmpty(values.panNumber)) {
    errors.panNumber = 'PAN card number is required';
  } else if (values.panNumber) {
    const panError = validatePanNumber(values.panNumber);
    if (panError) errors.panNumber = panError;
  }

  if (includesInvest && isEmpty(values.accountHolderName)) {
    errors.accountHolderName = 'Account holder name is required';
  }

  if (includesInvest && isEmpty(values.accountNumber)) {
    errors.accountNumber = 'Account number is required';
  } else if (values.accountNumber) {
    const accountError = validateBankAccountNumber(values.accountNumber);
    if (accountError) errors.accountNumber = accountError;
  }

  if (includesInvest && isEmpty(values.confirmAccountNumber)) {
    errors.confirmAccountNumber = 'Please confirm your account number';
  } else if (includesInvest && values.accountNumber !== values.confirmAccountNumber) {
    errors.confirmAccountNumber = 'Account numbers do not match';
  }

  if (includesInvest && isEmpty(values.ifscCode)) {
    errors.ifscCode = 'IFSC code is required';
  } else if (values.ifscCode) {
    const ifscError = validateIfscCode(values.ifscCode);
    if (ifscError) errors.ifscCode = ifscError;
  }

  if (includesInvest && isEmpty(values.bankName)) errors.bankName = 'Bank name is required';
  if (includesInvest && isEmpty(values.branchName)) errors.branchName = 'Branch name is required';

  if (includesInvest && isEmpty(values.nomineeName)) errors.nomineeName = 'Nominee name is required';
  if (includesInvest && isEmpty(values.relationship)) errors.relationship = 'Relationship is required';

  if (includesInvest && isEmpty(values.nomineeAadhaar)) {
    errors.nomineeAadhaar = 'Nominee Aadhaar number is required';
  } else if (values.nomineeAadhaar) {
    const nomineeAadhaarError = validateAadhaarNumber(values.nomineeAadhaar);
    if (nomineeAadhaarError) errors.nomineeAadhaar = nomineeAadhaarError;
  }

  if (includesInvest && isEmpty(values.nomineeMobile)) {
    errors.nomineeMobile = "Nominee's mobile number is required";
  } else if (values.nomineeMobile) {
    const nomineeMobileError = validateIndianMobile(values.nomineeMobile);
    if (nomineeMobileError) errors.nomineeMobile = nomineeMobileError;
  }

  if (includesInvest && isEmpty(values.nomineePan)) {
    errors.nomineePan = "Nominee's PAN is required";
  } else if (values.nomineePan) {
    const nomineePanError = validatePanNumber(values.nomineePan);
    if (nomineePanError) errors.nomineePan = nomineePanError;
  }

  const passwordError = validatePasswordComplexity(values.password);
  if (passwordError) {
    errors.password = passwordError;
  }

  if (isEmpty(values.confirmPassword)) {
    errors.confirmPassword = 'Please confirm your password';
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  const mpinError = validateMpin(values.mpin);
  if (mpinError) {
    errors.mpin = mpinError;
  }

  if (isEmpty(values.confirmMpin)) {
    errors.confirmMpin = 'Please confirm your MPIN';
  } else if (values.mpin !== values.confirmMpin) {
    errors.confirmMpin = 'MPINs do not match';
  }

  if (!values.authorized) {
    errors.authorized = 'Please accept the terms to continue';
  }

  return errors;
}

export function hasFormErrors(errors: RegistrationFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
