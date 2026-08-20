export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

export interface InitiatePaymentInput {
  paymentId: number;
  orderId: string;
  amount: number;
  currency: string;
  phone: string;
  packageName: string;
  callbackUrl: string;
  redirectUrl: string;
  cancelUrl: string;
}

export interface InitiatePaymentResult {
  providerReference: string;
  providerOrderId: string;
  status: PaymentStatus;
  message: string;
  paymentUrl?: string;
  raw?: unknown;
}

export interface PaymentProvider {
  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  queryPaymentStatus(orderId: string): Promise<{
    status: PaymentStatus;
    providerReference?: string;
    amount?: number;
    currency?: string;
    raw?: unknown;
  }>;
  verifyPayment(orderId: string): Promise<{ status: PaymentStatus }>;
}
