import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Inventory, InventoryRequest, AssetDetail } from '../models/inventory.model';
import { PagedResponse } from '../models/paged-response.model';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/api/inventory`;

  list(params: {
    search?: string;
    environment?: string;
    status?: string;
    assetType?: string;
    page?: number;
    size?: number;
  }): Observable<PagedResponse<Inventory>> {
    let p = new HttpParams();
    if (params.search) p = p.set('search', params.search);
    if (params.environment) p = p.set('environment', params.environment);
    if (params.status) p = p.set('status', params.status);
    if (params.assetType) p = p.set('assetType', params.assetType);
    p = p.set('page', params.page ?? 0);
    p = p.set('size', params.size ?? 20);
    return this.http.get<PagedResponse<Inventory>>(this.base, { params: p });
  }

  getByHostname(hostname: string): Observable<Inventory> {
    return this.http.get<Inventory>(`${this.base}/${hostname}`);
  }

  getDetail(hostname: string): Observable<AssetDetail> {
    return this.http.get<AssetDetail>(`${this.base}/${hostname}/detail`);
  }

  create(req: InventoryRequest): Observable<Inventory> {
    return this.http.post<Inventory>(this.base, req);
  }

  update(hostname: string, req: InventoryRequest): Observable<Inventory> {
    return this.http.put<Inventory>(`${this.base}/${hostname}`, req);
  }

  delete(hostname: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${hostname}`);
  }
}
