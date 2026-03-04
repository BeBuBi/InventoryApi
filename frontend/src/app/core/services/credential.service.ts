import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Credential, CredentialRequest } from '../models/credential.model';

@Injectable({ providedIn: 'root' })
export class CredentialService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/api/settings/credentials`;

  listByService(service: string): Observable<Credential[]> {
    const params = new HttpParams().set('service', service);
    return this.http.get<Credential[]>(this.base, { params });
  }

  create(req: CredentialRequest): Observable<Credential> {
    return this.http.post<Credential>(this.base, req);
  }

  update(id: number, req: CredentialRequest): Observable<Credential> {
    return this.http.put<Credential>(`${this.base}/${id}`, req);
  }

  enable(id: number): Observable<Credential> {
    return this.http.patch<Credential>(`${this.base}/${id}/enable`, null);
  }

  disable(id: number): Observable<Credential> {
    return this.http.patch<Credential>(`${this.base}/${id}/disable`, null);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
