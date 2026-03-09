import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NewRelicRecord } from '../models/newrelic.model';
import { SyncStatus } from '../models/sync-schedule.model';
import { PagedResponse } from '../models/paged-response.model';

@Injectable({ providedIn: 'root' })
export class NewRelicService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/api/newrelic`;

  list(params: {
    search?: string;
    application?: string;
    environment?: string;
    accountIds?: string[];
    linuxDistros?: string[];
    page?: number;
    size?: number;
  }): Observable<PagedResponse<NewRelicRecord>> {
    let p = new HttpParams();
    if (params.search) p = p.set('search', params.search);
    if (params.application) p = p.set('application', params.application);
    if (params.environment) p = p.set('environment', params.environment);
    (params.accountIds ?? []).forEach(v => p = p.append('accountIds', v));
    (params.linuxDistros ?? []).forEach(v => p = p.append('linuxDistros', v));
    p = p.set('page', params.page ?? 0);
    p = p.set('size', params.size ?? 20);
    return this.http.get<PagedResponse<NewRelicRecord>>(this.base, { params: p });
  }

  getAccountIds(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/accounts`);
  }

  getLinuxDistros(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/linux-distros`);
  }

  getByHostname(hostname: string): Observable<NewRelicRecord> {
    return this.http.get<NewRelicRecord>(`${this.base}/${hostname}`);
  }

  triggerSync(): Observable<SyncStatus> {
    return this.http.post<SyncStatus>(`${this.base}/sync`, null);
  }

  getSyncStatus(): Observable<SyncStatus> {
    return this.http.get<SyncStatus>(`${this.base}/sync/status`);
  }
}
