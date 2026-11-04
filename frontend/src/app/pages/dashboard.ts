import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage, ProjectSummary } from '../core/api';
import { Icon } from '../core/icon';
import { Session } from '../core/session';
import { newSite, TEMPLATES } from '../engine/templates';

@Component({
  selector: 'ssm-dashboard',
  imports: [RouterLink, DatePipe, Icon],
  template: `
    <header class="border-b border-zinc-200 bg-white">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <span class="font-semibold">Static Site Maker</span>
        <div class="flex items-center gap-3 text-sm">
          <span class="truncate text-zinc-600">{{ session.user()?.name }}</span>
          <button class="ui-btn" (click)="logout()">Log out</button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-4 py-8">
      <div class="mb-5 flex items-center justify-between gap-4">
        <h1 class="text-xl font-semibold">Your sites</h1>
        <button class="ui-btn ui-btn-primary" (click)="creating.set(true)"><ssm-icon name="plus" [size]="16" /> New site</button>
      </div>

      @if (error()) {
        <p class="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ error() }}</p>
      }

      @if (loaded() && !projects().length) {
        <div class="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center">
          <p class="font-medium">No sites yet</p>
          <p class="mt-1 mb-4 text-sm text-zinc-600">Create your first site, then export it as files you can upload with FileZilla.</p>
          <button class="ui-btn ui-btn-primary" (click)="creating.set(true)">Create a site</button>
        </div>
      }

      <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        @for (project of projects(); track project.id) {
          <li class="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-2 pl-4">
            <a class="min-w-0 flex-1 py-1.5" [routerLink]="['/projects', project.id]">
              <span class="block truncate font-medium hover:text-indigo-700">{{ project.name }}</span>
              <span class="block text-xs text-zinc-500">Edited {{ project.updated_at.replace(' ', 'T') | date: 'mediumDate' }}</span>
            </a>
            <button class="ui-icon-btn" title="Duplicate" [attr.aria-label]="'Duplicate ' + project.name" (click)="duplicate(project)"><ssm-icon name="copy" [size]="16" /></button>
            <button class="ui-icon-btn" title="Delete" [attr.aria-label]="'Delete ' + project.name" (click)="remove(project)"><ssm-icon name="trash" [size]="16" /></button>
          </li>
        }
      </ul>
    </main>

    @if (creating()) {
      <div class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" (keydown.escape)="creating.set(false)">
        <form class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" (submit)="create($event)">
          <h2 class="mb-4 text-lg font-semibold">New site</h2>
          <label class="ui-label">Name
            <input class="ui-input mt-1" name="name" required maxlength="160" autofocus>
          </label>
          <fieldset class="mt-4">
            <legend class="ui-label">Start from</legend>
            @for (template of templates; track template.id; let first = $first) {
              <label class="mb-1.5 flex cursor-pointer items-start gap-2.5 rounded-md border border-zinc-200 p-2.5 has-checked:border-indigo-500 has-checked:bg-indigo-50">
                <input class="mt-1" type="radio" name="template" [value]="template.id" [checked]="first">
                <span>
                  <span class="block text-sm font-medium">{{ template.name }}</span>
                  <span class="block text-xs text-zinc-600">{{ template.description }}</span>
                </span>
              </label>
            }
          </fieldset>
          <div class="mt-5 flex justify-end gap-2">
            <button type="button" class="ui-btn" (click)="creating.set(false)">Cancel</button>
            <button class="ui-btn ui-btn-primary">Create site</button>
          </div>
        </form>
      </div>
    }
  `,
})
export class Dashboard implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly session = inject(Session);

  protected readonly templates = TEMPLATES;
  protected readonly projects = signal<ProjectSummary[]>([]);
  protected readonly loaded = signal(false);
  protected readonly creating = signal(false);
  protected readonly error = signal('');

  async ngOnInit() {
    await this.attempt(async () => {
      this.projects.set(await this.api.projects());
      this.loaded.set(true);
    });
  }

  protected async create(event: Event) {
    event.preventDefault();
    const form = new FormData(event.target as HTMLFormElement);
    const name = String(form.get('name')).trim();
    await this.attempt(async () => {
      const project = await this.api.createProject(name, newSite(name, String(form.get('template'))));
      await this.router.navigate(['/projects', project.id]);
    });
  }

  protected async duplicate(project: ProjectSummary) {
    await this.attempt(async () => {
      await this.api.duplicateProject(project.id);
      this.projects.set(await this.api.projects());
    });
  }

  protected async remove(project: ProjectSummary) {
    if (!confirm(`Delete "${project.name}" and all its files? This can't be undone.`)) return;
    await this.attempt(async () => {
      await this.api.deleteProject(project.id);
      this.projects.update((list) => list.filter((p) => p.id !== project.id));
    });
  }

  protected async logout() {
    await this.session.logout();
    await this.router.navigateByUrl('/login');
  }

  private async attempt(action: () => Promise<void>) {
    this.error.set('');
    try {
      await action();
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
