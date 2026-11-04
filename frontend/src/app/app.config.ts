import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { routes } from './app.routes';
import { apiHeaderInterceptor } from './core/api';
import { Session } from './core/session';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Hash routes need no server rewrites, so the app runs from any subfolder.
    provideRouter(routes, withHashLocation(), withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([apiHeaderInterceptor])),
    provideAppInitializer(() => inject(Session).load()),
  ],
};
