import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { Session } from './core/session';

const signedIn = () => inject(Session).user() !== null || inject(Router).parseUrl('/login');
const signedOut = () => inject(Session).user() === null || inject(Router).parseUrl('/');

export const routes: Routes = [
  { path: 'login', canActivate: [signedOut], loadComponent: () => import('./pages/login').then((m) => m.Login) },
  { path: '', pathMatch: 'full', canActivate: [signedIn], loadComponent: () => import('./pages/dashboard').then((m) => m.Dashboard) },
  { path: 'projects/:id', canActivate: [signedIn], loadComponent: () => import('./editor/editor').then((m) => m.Editor) },
  { path: '**', redirectTo: '' },
];
