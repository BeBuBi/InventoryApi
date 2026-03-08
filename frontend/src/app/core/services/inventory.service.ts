import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Inventory, InventoryCounts } from '../models/inventory.model';
import { PagedResponse } from '../models/paged-response.model';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/api/inventory`;

  list(params: {
    search?: string;
    environment?: string;
    operationalStatus?: string;
    sources?: string;
    page?: number;
    size?: number;
  }): Observable<PagedResponse<Inventory>> {
    let p = new HttpParams();
    if (params.search) p = p.set('search', params.search);
    if (params.environment) p = p.set('environment', params.environment);
    if (params.operationalStatus) p = p.set('operationalStatus', params.operationalStatus);
    if (params.sources) p = p.set('sources', params.sources);
    p = p.set('page', params.page ?? 0);
    p = p.set('size', params.size ?? 20);
    return this.http.get<PagedResponse<Inventory>>(this.base, { params: p });
  }

  getCounts(): Observable<InventoryCounts> {
    return this.http.get<InventoryCounts>(`${this.base}/counts`);
  }

  getByHostname(hostname: string): Observable<Inventory> {
    return this.http.get<Inventory>(`${this.base}/${hostname}`);
  }
}
