export interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}

export class ConsoleSmsProvider implements SmsProvider {
  async send(to: string, message: string): Promise<void> {
    console.log(`[sms:console] to=${to} message="${message}"`);
  }
}
