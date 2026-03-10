import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CmdbRecord } from '../models/cmdb.model';
import { SyncStatus } from '../models/sync-schedule.model';
import { PagedResponse } from '../models/paged-response.model';

@Injectable({ providedIn: 'root' })
export class CmdbService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/api/cmdb`;

  list(params: {
    search?: string;
    opStatuses?: string[];
    osVersions?: string[];
    page?: number;
    size?: number;
  }): Observable<PagedResponse<CmdbRecord>> {
    let p = new HttpParams();
    if (params.search) p = p.set('search', params.search);
    (params.opStatuses ?? []).forEach(v => p = p.append('opStatuses', v));
    (params.osVersions ?? []).forEach(v => p = p.append('osVersions', v));
    p = p.set('page', params.page ?? 0);
    p = p.set('size', params.size ?? 20);
    return this.http.get<PagedResponse<CmdbRecord>>(this.base, { params: p });
  }

  listOperationalStatuses(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/operational-statuses`);
  }

  getOsVersions(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/os-versions`);
  }

  triggerSync(): Observable<SyncStatus> {
    return this.http.post<SyncStatus>(`${this.base}/sync`, null);
  }

  getSyncStatus(): Observable<SyncStatus> {
    return this.http.get<SyncStatus>(`${this.base}/sync/status`);
  }
}
