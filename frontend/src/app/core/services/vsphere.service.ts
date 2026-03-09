import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { VsphereRecord } from '../models/vsphere.model';
import { SyncStatus } from '../models/sync-schedule.model';
import { PagedResponse } from '../models/paged-response.model';

@Injectable({ providedIn: 'root' })
export class VsphereService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/api/vsphere`;

  list(params: {
    search?: string;
    powerStates?: string[];
    sourceUrls?: string[];
    guestOsTypes?: string[];
    page?: number;
    size?: number;
  }): Observable<PagedResponse<VsphereRecord>> {
    let p = new HttpParams();
    if (params.search) p = p.set('search', params.search);
    (params.powerStates ?? []).forEach(v => p = p.append('powerStates', v));
    (params.sourceUrls ?? []).forEach(v => p = p.append('sourceUrls', v));
    (params.guestOsTypes ?? []).forEach(v => p = p.append('guestOsTypes', v));
    p = p.set('page', params.page ?? 0);
    p = p.set('size', params.size ?? 20);
    return this.http.get<PagedResponse<VsphereRecord>>(this.base, { params: p });
  }

  getSourceUrls(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/vcenter-urls`);
  }

  getGuestOsTypes(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/guest-os-types`);
  }

  getByHostname(hostname: string): Observable<VsphereRecord> {
    return this.http.get<VsphereRecord>(`${this.base}/${hostname}`);
  }

  triggerSync(): Observable<SyncStatus> {
    return this.http.post<SyncStatus>(`${this.base}/sync`, null);
  }

  getSyncStatus(): Observable<SyncStatus> {
    return this.http.get<SyncStatus>(`${this.base}/sync/status`);
  }
}
