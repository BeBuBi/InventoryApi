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
    cluster?: string;
    datacenter?: string;
    powerState?: string;
    page?: number;
    size?: number;
  }): Observable<PagedResponse<VsphereRecord>> {
    let p = new HttpParams();
    if (params.search) p = p.set('search', params.search);
    if (params.cluster) p = p.set('cluster', params.cluster);
    if (params.datacenter) p = p.set('datacenter', params.datacenter);
    if (params.powerState) p = p.set('powerState', params.powerState);
    p = p.set('page', params.page ?? 0);
    p = p.set('size', params.size ?? 20);
    return this.http.get<PagedResponse<VsphereRecord>>(this.base, { params: p });
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
