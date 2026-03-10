import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResponse } from '../../core/models/paged-response.model';

export interface IpDiscrepancyEntry {
  hostname: string;
  vsphereIps: string[];   // IPv4s from vSphere
  nrIps: string[];        // IPv4s from New Relic
  cmdbIps: string[];      // IPv4s from CMDB
  notInCmdb: string[];    // source IPs not found in CMDB
  sources?: string;
  discrepancyType: string;
  powerState?: string;
  guestOs?: string;
}

@Component({
  selector: 'app-ip-discrepancy',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="p-6">
      <div class="mb-6">
        <h1 class="text-xl font-semibold text-gray-900">IP Address Discrepancy</h1>
        <p class="mt-1 text-sm text-gray-500">
          For each host, every IPv4 from vSphere and New Relic is checked against the CMDB IP list.
          IPs highlighted in red are not present in CMDB.
        </p>
      </div>

      <!-- Count badge + Export -->
      <div class="mb-6 flex items-center justify-between gap-4">
        <div class="inline-flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <svg class="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          <span class="text-sm font-medium text-red-800">
            {{ totalCount | number }} host{{ totalCount !== 1 ? 's' : '' }} with IP discrepancies
          </span>
        </div>
        <button (click)="exportCsv()" [disabled]="rows.length === 0"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Export CSV
        </button>
      </div>

      <!-- Table -->
      <div class="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                <div>Hostname</div>
                <input type="search" [(ngModel)]="searchQuery" (ngModelChange)="onSearch($event)"
                       placeholder="Filter…"
                       class="mt-1 w-full px-2 py-1 text-xs font-normal normal-case border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"/>
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">vSphere IPv4</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NR IPv4</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CMDB IP</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Not in CMDB</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sources</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr *ngIf="loading">
              <td colspan="6" class="px-4 py-8 text-center text-gray-400">Loading…</td>
            </tr>
            <tr *ngIf="!loading && rows.length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-gray-400">No discrepancies found.</td>
            </tr>
            <tr *ngFor="let row of rows" class="hover:bg-gray-50 transition-colors">

              <!-- Hostname -->
              <td class="px-4 py-2.5 font-mono text-xs text-blue-600 hover:underline">
                <a [routerLink]="['/inventory', row.hostname]">{{ row.hostname }}</a>
              </td>

              <!-- vSphere IPs: red if not in CMDB, green if in CMDB -->
              <td class="px-4 py-2.5">
                <div *ngIf="row.vsphereIps.length; else dash" class="flex flex-wrap gap-1">
                  <span *ngFor="let ip of row.vsphereIps"
                        [ngClass]="row.notInCmdb.includes(ip) ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : 'bg-green-50 text-green-700'"
                        class="inline-block px-2 py-0.5 rounded-full text-xs font-mono">
                    {{ ip }}
                  </span>
                </div>
              </td>

              <!-- NR IPs: red if not in CMDB, green if in CMDB -->
              <td class="px-4 py-2.5">
                <div *ngIf="row.nrIps.length; else dash" class="flex flex-wrap gap-1">
                  <span *ngFor="let ip of row.nrIps"
                        [ngClass]="row.notInCmdb.includes(ip) ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : 'bg-green-50 text-green-700'"
                        class="inline-block px-2 py-0.5 rounded-full text-xs font-mono">
                    {{ ip }}
                  </span>
                </div>
              </td>

              <!-- CMDB IPs (reference) -->
              <td class="px-4 py-2.5">
                <div *ngIf="row.cmdbIps.length; else noCmdb" class="flex flex-wrap gap-1">
                  <span *ngFor="let ip of row.cmdbIps"
                        class="inline-block px-2 py-0.5 rounded-full text-xs bg-orange-50 text-orange-700 font-mono">
                    {{ ip }}
                  </span>
                </div>
                <ng-template #noCmdb>
                  <span class="px-2 py-0.5 rounded text-xs bg-red-50 text-red-600 font-medium">missing</span>
                </ng-template>
              </td>

              <!-- IPs not in CMDB (summary) -->
              <td class="px-4 py-2.5">
                <div class="flex flex-wrap gap-1">
                  <span *ngFor="let ip of row.notInCmdb"
                        class="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800 font-mono font-medium">
                    {{ ip }}
                  </span>
                </div>
              </td>

              <!-- Sources -->
              <td class="px-4 py-2.5">
                <div class="flex flex-wrap gap-1">
                  <span *ngIf="row.sources?.includes('vsphere')" class="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">vsphere</span>
                  <span *ngIf="row.sources?.includes('newrelic')" class="px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">newrelic</span>
                  <span *ngIf="row.sources?.includes('cmdb')" class="px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">cmdb</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div class="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
          <div class="flex items-center gap-2">
            <span class="text-gray-500">Rows:</span>
            <select [(ngModel)]="pageSize" (ngModelChange)="onPageSizeChange()"
                    class="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none">
              <option [ngValue]="25">25</option>
              <option [ngValue]="50">50</option>
              <option [ngValue]="100">100</option>
            </select>
            <span class="text-gray-400">&middot;</span>
            <span>{{ totalCount }} records</span>
          </div>
          <div class="flex gap-2">
            <button (click)="goToPage(currentPage - 1)" [disabled]="currentPage === 0"
                    class="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <span class="px-3 py-1">Page {{ currentPage + 1 }} of {{ totalPages }}</span>
            <button (click)="goToPage(currentPage + 1)" [disabled]="currentPage >= totalPages - 1"
                    class="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      </div>
    </div>

    <ng-template #dash><span class="text-gray-300 text-xs">—</span></ng-template>
  `
})
export class IpDiscrepancyComponent implements OnInit {
  private http = inject(HttpClient);
  private search$ = new Subject<string>();

  rows: IpDiscrepancyEntry[] = [];
  loading = false;
  totalCount = 0;
  totalPages = 0;
  currentPage = 0;
  pageSize = 25;
  searchQuery = '';

  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => { this.searchQuery = q; this.currentPage = 0; return this.fetchPage(); })
    ).subscribe(resp => this.applyResponse(resp));
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.fetchPage().subscribe({
      next: resp => { this.applyResponse(resp); this.loading = false; },
      error: ()   => { this.loading = false; }
    });
  }

  private fetchPage() {
    let params = new HttpParams().set('page', this.currentPage).set('size', this.pageSize);
    if (this.searchQuery) params = params.set('search', this.searchQuery);
    return this.http.get<PagedResponse<IpDiscrepancyEntry>>(
      `${environment.apiBaseUrl}/api/reports/ip-discrepancy`, { params });
  }

  private applyResponse(resp: PagedResponse<IpDiscrepancyEntry>): void {
    this.rows = resp.content;
    this.totalCount = resp.totalElements;
    this.totalPages = resp.totalPages;
  }

  onSearch(q: string): void { this.search$.next(q); }
  goToPage(p: number): void { this.currentPage = p; this.load(); }
  onPageSizeChange(): void  { this.currentPage = 0; this.load(); }

  exportCsv(): void {
    let params = new HttpParams().set('page', 0).set('size', 10000);
    if (this.searchQuery) params = params.set('search', this.searchQuery);

    this.http.get<PagedResponse<IpDiscrepancyEntry>>(
      `${environment.apiBaseUrl}/api/reports/ip-discrepancy`, { params }
    ).subscribe(resp => {
      const headers = ['hostname', 'vSphere IPv4', 'NR IPv4', 'CMDB IP', 'Not in CMDB', 'Sources'];
      const rows = [
        headers.join(','),
        ...resp.content.map(r => [
          r.hostname,
          r.vsphereIps.join('; '),
          r.nrIps.join('; '),
          r.cmdbIps.join('; '),
          r.notInCmdb.join('; '),
          r.sources ?? ''
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      ];
      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ip-discrepancy-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}
