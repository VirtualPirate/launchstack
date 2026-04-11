export class Resend {
  constructor(_apiKey: string) {}
  emails = {
    send: async (_opts: any) => ({ id: 'mock' }),
  };
}
