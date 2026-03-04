import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SyncSchedule, SyncScheduleRequest } from '../models/sync-schedule.model';

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/api/settings/schedule`;

  listAll(): Observable<SyncSchedule[]> {
    return this.http.get<SyncSchedule[]>(this.base);
  }

  getByService(service: string): Observable<SyncSchedule> {
    return this.http.get<SyncSchedule>(`${this.base}/${service}`);
  }

  update(service: string, req: SyncScheduleRequest): Observable<SyncSchedule> {
    return this.http.put<SyncSchedule>(`${this.base}/${service}`, req);
  }

  enable(service: string): Observable<SyncSchedule> {
    return this.http.patch<SyncSchedule>(`${this.base}/${service}/enable`, null);
  }

  disable(service: string): Observable<SyncSchedule> {
    return this.http.patch<SyncSchedule>(`${this.base}/${service}/disable`, null);
  }
}
