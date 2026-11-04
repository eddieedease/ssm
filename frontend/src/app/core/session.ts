import { inject, Injectable, signal } from '@angular/core';
import { Api, User } from './api';

@Injectable({ providedIn: 'root' })
export class Session {
  private readonly api = inject(Api);

  readonly state = signal<'ready' | 'not-installed' | 'offline'>('ready');
  readonly user = signal<User | null>(null);
  readonly allowRegistration = signal(false);

  async load() {
    try {
      const config = await this.api.config();
      this.state.set(config.installed ? 'ready' : 'not-installed');
      this.user.set(config.user ?? null);
      this.allowRegistration.set(config.allowRegistration ?? false);
    } catch {
      this.state.set('offline');
    }
  }

  async logout() {
    await this.api.logout();
    this.user.set(null);
  }
}
