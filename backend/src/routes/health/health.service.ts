export interface DatabaseHealthCheck {
  check(): Promise<void>;
}

export class HealthService {
  public constructor(private readonly database: DatabaseHealthCheck) {}

  public getLiveness(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  public async getReadiness(): Promise<{ status: 'ok' | 'error'; timestamp: string }> {
    try {
      await this.database.check();
      return { status: 'ok', timestamp: new Date().toISOString() };
    } catch {
      return { status: 'error', timestamp: new Date().toISOString() };
    }
  }
}
