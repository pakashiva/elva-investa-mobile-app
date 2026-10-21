import { apiRequest } from '../lib/api';

export type BorrowLoan = {
  id: string; loan_number: string; status: string; principal_amount: number | string;
  interest_rate_percent: number | string; terms_snapshot: Record<string, unknown>;
  start_date: string | null; maturity_date: string | null; disbursed_at: string | null;
  closed_at: string | null; created_at: string; product_name: string;
  interest_model: string; interest_rate_period: string; repayment_model: string;
  repayment_frequency: string; grace_period_days: number; required_documents: string[];
  receipt_required: boolean;
  request_type?: 'standard' | 'custom';
  custom_duration_days?: number | null;
  repayment_preference?: 'maturity' | 'flexible' | null;
  counter_offer?: { principal_amount: number; interest_rate_percent: number; duration_days: number; repayment_preference: 'maturity' | 'flexible'; total_repayment: number } | null;
};

export type BorrowScheduleRow = {
  loan_id?: string; id: string; installment_number: number; due_date: string;
  principal_due: number | string; interest_due: number | string;
  overdue_charge: number | string; amount_paid: number | string; status: string;
};

export type BorrowLedgerRow = {
  loan_id?: string; id: string; event_type: string;
  principal_debit: number | string; principal_credit: number | string;
  interest_debit: number | string; interest_credit: number | string;
  overdue_debit: number | string; overdue_credit: number | string;
  event_date: string; description: string; created_at: string;
};

export type BorrowPayment = {
  loan_id?: string; id: string; received_on: string; amount_received: number | string;
  principal_component: number | string; interest_component: number | string;
  overdue_component: number | string; unapplied_amount: number | string;
  reference_number: string | null; status: string; created_at: string;
};

export type BorrowDocument = { id: string; document_type: string; original_name: string; mime_type: string | null; size_bytes: number | null; created_at: string };

export type BorrowingSnapshot = {
  loans: BorrowLoan[];
  schedules: BorrowScheduleRow[];
  ledger: BorrowLedgerRow[];
  payments: BorrowPayment[];
};

export type LoanProduct = {
  id: string;
  name: string;
  interest_model: 'simple' | 'flat' | 'reducing_balance';
  interest_rate_percent: number | string;
  interest_rate_period: 'daily' | 'weekly' | 'monthly' | 'annual';
  interest_frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'at_maturity';
  repayment_model: 'interest_only' | 'principal_and_interest' | 'bullet';
  repayment_frequency: 'weekly' | 'monthly' | 'quarterly' | 'at_maturity';
  payment_allocation: 'interest_first' | 'principal_first';
  grace_period_days: number;
  overdue_rule: 'status_only' | 'percentage_charge' | 'fixed_charge';
  overdue_charge: number | string;
  part_payments_allowed: boolean;
  advance_payment_treatment: string;
  approval_workflow: 'manual' | 'direct_activation';
  rounding_scale: number;
  required_documents: string[];
};

export type RepaymentInstallment = {
  dueDate: string;
  principalDue: number;
  interestDue: number;
};

export async function getLoanProducts(): Promise<LoanProduct[]> {
  const data = await apiRequest<{ products?: LoanProduct[] }>('/api/mobile/borrowing/products');
  return data.products ?? [];
}

export async function getBorrowingAccess(): Promise<boolean> {
  const data = await apiRequest<{ enabled: boolean }>('/api/mobile/borrowing/access');
  return data.enabled === true;
}

export async function getBorrowingSnapshot(): Promise<BorrowingSnapshot> {
  return apiRequest<BorrowingSnapshot>('/api/mobile/borrowing/loans');
}

export type BorrowingLoanDetail = {
  loan: BorrowLoan;
  schedules: BorrowScheduleRow[];
  ledger: BorrowLedgerRow[];
  payments: BorrowPayment[];
  documents: BorrowDocument[];
};

export async function getBorrowingLoanDetail(loanId: string): Promise<BorrowingLoanDetail> {
  return apiRequest<BorrowingLoanDetail>(`/api/mobile/borrowing/loans/${encodeURIComponent(loanId)}`);
}

export async function getBorrowingDocument(documentId: string): Promise<{ original_name: string; mime_type: string; base64: string }> {
  const data = await apiRequest<{ document: { original_name: string; mime_type: string; base64: string } }>(
    `/api/mobile/borrowing/documents/${encodeURIComponent(documentId)}`
  );
  return data.document;
}

function round(value: number, scale: number) {
  const factor = 10 ** scale;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

function dateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function calculateRepaymentSchedule(
  product: LoanProduct,
  principal: number,
  termMonths: number,
  start = new Date()
): RepaymentInstallment[] {
  if (!Number.isFinite(principal) || principal <= 0 || !Number.isInteger(termMonths) || termMonths < 1) return [];
  const frequency = product.repayment_frequency;
  const count = frequency === 'at_maturity' ? 1
    : frequency === 'weekly' ? Math.ceil(termMonths * 4.345)
      : frequency === 'quarterly' ? Math.ceil(termMonths / 3) : termMonths;
  if (count > 600) return [];
  const rate = Number(product.interest_rate_percent) / 100;
  const divisor = product.interest_rate_period === 'annual' ? 12
    : product.interest_rate_period === 'monthly' ? 1
      : product.interest_rate_period === 'weekly' ? 4.345 : 30.437;
  const periodRate = rate / divisor * (frequency === 'quarterly' ? 3 : frequency === 'weekly' ? 0.23 : 1);
  const scale = Math.max(0, Math.min(4, Number(product.rounding_scale) || 2));
  const payment = product.repayment_model === 'principal_and_interest' && periodRate > 0 && product.interest_model === 'reducing_balance'
    ? principal * periodRate / (1 - Math.pow(1 + periodRate, -count))
    : principal / count + (product.repayment_model === 'principal_and_interest' ? principal * periodRate : 0);
  let balance = principal;
  return Array.from({ length: count }, (_, index) => {
    const installment = index + 1;
    let due: Date;
    if (frequency === 'weekly') {
      due = new Date(start);
      due.setDate(due.getDate() + 7 * installment);
    } else {
      due = addMonths(start, frequency === 'at_maturity' ? termMonths : frequency === 'quarterly' ? installment * 3 : installment);
    }
    const interestBasis = product.interest_model === 'reducing_balance' ? balance : principal;
    let principalDue = 0;
    let interestDue = 0;
    if (product.repayment_model === 'bullet') {
      principalDue = installment === count ? balance : 0;
      interestDue = interestBasis * periodRate * (frequency === 'at_maturity' ? count : 1);
    } else if (product.repayment_model === 'interest_only') {
      interestDue = interestBasis * periodRate * (frequency === 'at_maturity' ? count : 1);
      principalDue = installment === count ? balance : 0;
    } else {
      interestDue = interestBasis * periodRate * (frequency === 'at_maturity' ? count : 1);
      principalDue = Math.min(balance, payment - interestDue);
      if (installment === count) principalDue = balance;
    }
    principalDue = round(Math.max(principalDue, 0), scale);
    interestDue = round(Math.max(interestDue, 0), scale);
    balance = Math.max(0, balance - principalDue);
    return { dueDate: dateOnly(due), principalDue, interestDue };
  });
}

export async function submitLoanRequest(input: {
  productId: string;
  principalAmount: number;
  termMonths: number;
  purpose: string;
  notes: string;
  schedule: RepaymentInstallment[];
  documents?: { name: string; mimeType: string; base64: string }[];
}) {
  return apiRequest<{ loanId: string; loanNumber: string; status: string }>(
    '/api/mobile/borrowing/requests',
    { method: 'POST', body: JSON.stringify(input) }
  );
}

export async function submitCustomLoanRequest(input: { principalAmount: number; durationDays: number; requestedInterestRatePercent: number|null; repaymentPreference: 'maturity' | 'flexible'; purpose: string; notes: string; submissionKey: string }) {
  return apiRequest<{ loanId: string; loanNumber: string; status: string }>('/api/mobile/borrowing/requests', { method: 'POST', body: JSON.stringify({ ...input, requestType: 'custom' }) });
}

export async function respondToCustomOffer(loanId: string, accept: boolean) {
  return apiRequest<{ status: string }>(`/api/mobile/borrowing/requests/${encodeURIComponent(loanId)}/offer-response`, { method: 'PATCH', body: JSON.stringify({ accept }) });
}
