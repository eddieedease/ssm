import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Session } from './core/session';

@Component({
  selector: 'ssm-root',
  imports: [RouterOutlet],
  template: `
    @if (session.state() === 'ready') {
      <router-outlet />
    } @else {
      <main class="grid min-h-screen place-items-center p-4">
        <div class="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 text-center">
          @if (session.state() === 'not-installed') {
            <h1 class="text-lg font-semibold">Static Site Maker isn't installed yet</h1>
            <p class="mt-1 mb-4 text-sm text-zinc-600">Run the web installer to set up the database and your administrator account.</p>
            <a class="ui-btn ui-btn-primary" href="install/">Open the installer</a>
          } @else {
            <h1 class="text-lg font-semibold">Can't reach the server</h1>
            <p class="mt-1 mb-4 text-sm text-zinc-600">The API isn't responding. In development, check that Docker is running.</p>
            <button class="ui-btn" (click)="reload()">Try again</button>
          }
        </div>
      </main>
    }
  `,
})
export class App {
  protected readonly session = inject(Session);

  protected reload() {
    location.reload();
  }
}
