import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api, errorMessage } from '../core/api';
import { Session } from '../core/session';

@Component({
  selector: 'ssm-login',
  template: `
    <main class="grid min-h-screen place-items-center p-4">
      <form class="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6" (submit)="submit($event)">
        <h1 class="text-xl font-semibold">{{ registering() ? 'Create your account' : 'Log in' }}</h1>
        <p class="mt-0.5 mb-5 text-sm text-zinc-500">Static Site Maker</p>

        @if (error()) {
          <p class="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ error() }}</p>
        }
        @if (registering()) {
          <label class="ui-label">Name
            <input class="ui-input mt-1" name="name" autocomplete="name" required>
          </label>
        }
        <label class="ui-label mt-3">Email
          <input class="ui-input mt-1" name="email" type="email" autocomplete="email" required>
        </label>
        <label class="ui-label mt-3">Password
          <input class="ui-input mt-1" name="password" type="password" required minlength="8"
            [attr.autocomplete]="registering() ? 'new-password' : 'current-password'">
        </label>
        <button class="ui-btn ui-btn-primary mt-5 w-full" [disabled]="busy()">
          {{ registering() ? 'Create account' : 'Log in' }}
        </button>
        @if (session.allowRegistration()) {
          <button type="button" class="mt-3 w-full cursor-pointer text-sm text-indigo-700 hover:underline"
            (click)="registering.set(!registering()); error.set('')">
            {{ registering() ? 'I already have an account' : 'Create an account' }}
          </button>
        }
      </form>
    </main>
  `,
})
export class Login {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly session = inject(Session);

  protected readonly registering = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async submit(event: Event) {
    event.preventDefault();
    const form = new FormData(event.target as HTMLFormElement);
    const email = String(form.get('email'));
    const password = String(form.get('password'));
    this.busy.set(true);
    this.error.set('');
    try {
      const user = this.registering()
        ? await this.api.register({ name: String(form.get('name')), email, password })
        : await this.api.login({ email, password });
      this.session.user.set(user);
      await this.router.navigateByUrl('/');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
