export class PgBoss {
  constructor(_options: unknown) {}

  on() {}
  async start() {}
  async stop() {}
  async send() {
    return 'mock-job-id';
  }
  async work() {
    return 'mock-worker-id';
  }
  async getJobById() {
    return null;
  }
}
