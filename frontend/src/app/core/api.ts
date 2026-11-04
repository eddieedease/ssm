import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { Site, Theme } from '../engine/model';

const API = 'api/index.php?r=';

/** Marks API calls so the backend can reject cross-site requests. */
export const apiHeaderInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.url.startsWith(API) ? req.clone({ setHeaders: { 'X-SSM': '1' } }) : req);

export interface User { id: number; name: string; email: string; is_admin: boolean; }
export interface AppConfig { installed: boolean; siteName?: string; allowRegistration?: boolean; user?: User | null; }
export interface ProjectSummary { id: number; name: string; updated_at: string; }
export interface Project { id: number; name: string; revision: number; assetBase: string; site: Site; }
export interface Asset { id: number; filename: string; originalName: string; mime: string; size: number; path: string; }
export interface SavedTheme { id: number; name: string; theme: Theme; }

/** Turns any failed call into a sentence that is safe to show to the user. */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && typeof error.error?.error === 'string') {
    return error.error.error;
  }
  return 'The request failed. Check your connection and try again.';
}

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  private call<T>(request: Observable<T>): Promise<T> {
    return firstValueFrom(request);
  }

  config() { return this.call(this.http.get<AppConfig>(`${API}config`)); }
  login(body: { email: string; password: string }) { return this.call(this.http.post<User>(`${API}auth/login`, body)); }
  register(body: { name: string; email: string; password: string }) { return this.call(this.http.post<User>(`${API}auth/register`, body)); }
  logout() { return this.call(this.http.post(`${API}auth/logout`, {})); }

  projects() { return this.call(this.http.get<ProjectSummary[]>(`${API}projects`)); }
  project(id: number) { return this.call(this.http.get<Project>(`${API}projects/${id}`)); }
  createProject(name: string, site: Site) { return this.call(this.http.post<Project>(`${API}projects`, { name, site })); }
  saveProject(id: number, name: string, revision: number, site: Site) {
    return this.call(this.http.put<{ revision: number }>(`${API}projects/${id}`, { name, revision, site }));
  }
  deleteProject(id: number) { return this.call(this.http.delete(`${API}projects/${id}`)); }
  duplicateProject(id: number) { return this.call(this.http.post<Project>(`${API}projects/${id}/duplicate`, {})); }
  async exportProject(id: number, files: Record<string, string>) {
    try {
      return await this.call(this.http.post(`${API}projects/${id}/export`, { files }, { responseType: 'blob' }));
    } catch (e) {
      // A blob request hands back errors as a blob too; restore the JSON message.
      if (e instanceof HttpErrorResponse && e.error instanceof Blob) {
        const body = JSON.parse(await e.error.text());
        throw new HttpErrorResponse({ status: e.status, error: body });
      }
      throw e;
    }
  }

  assets(projectId: number) { return this.call(this.http.get<Asset[]>(`${API}projects/${projectId}/assets`)); }
  uploadAsset(projectId: number, file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.call(this.http.post<Asset>(`${API}projects/${projectId}/assets`, form));
  }
  deleteAsset(id: number) { return this.call(this.http.delete(`${API}assets/${id}`)); }

  themes() { return this.call(this.http.get<SavedTheme[]>(`${API}themes`)); }
  saveTheme(name: string, theme: Theme) { return this.call(this.http.post<SavedTheme>(`${API}themes`, { name, theme })); }
  deleteTheme(id: number) { return this.call(this.http.delete(`${API}themes/${id}`)); }
}
