import { InitiatePaymentInput, InitiatePaymentResult, PaymentProvider, PaymentStatus } from './PaymentProvider';

export class MockPaymentProvider implements PaymentProvider {
  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    return {
      providerReference: `mock_${input.paymentId}_${Date.now()}`,
      providerOrderId: input.orderId,
      status: 'SUCCESS',
      message: 'Mock payment approved for local development',
    };
  }

  async queryPaymentStatus(_orderId: string): Promise<{ status: PaymentStatus }> {
    return { status: 'SUCCESS' };
  }

  async verifyPayment(_orderId: string): Promise<{ status: PaymentStatus }> {
    return { status: 'SUCCESS' };
  }
}
