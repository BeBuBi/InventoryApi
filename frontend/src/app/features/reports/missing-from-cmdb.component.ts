import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Inventory } from '../../core/models/inventory.model';
import { PagedResponse } from '../../core/models/paged-response.model';
import { MultiSelectComponent } from '../../shared/components/multi-select/multi-select.component';

@Component({
  selector: 'app-missing-from-cmdb',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MultiSelectComponent],
  template: `
    <div class="p-6">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-xl font-semibold text-gray-900">Missing from CMDB</h1>
        <p class="mt-1 text-sm text-gray-500">
          Hosts found in vSphere or New Relic that have no matching CMDB record.
        </p>
      </div>

      <!-- Summary card + Export -->
      <div class="mb-6 flex items-center justify-between gap-4">
        <div class="inline-flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <svg class="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          <span class="text-sm font-medium text-amber-800">
            {{ totalCount | number }} host{{ totalCount !== 1 ? 's' : '' }} not in CMDB
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
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-56">
                <div>Hostname</div>
                <input
                  type="search"
                  [(ngModel)]="searchQuery"
                  (ngModelChange)="onSearch($event)"
                  placeholder="Filter…"
                  class="mt-1 w-full px-2 py-1 text-xs font-normal normal-case border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">vSphere IPv4</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New Relic IPv4</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div>Sources</div>
                <app-multi-select
                  [options]="sourceOptions"
                  [selected]="selectedSources"
                  placeholder="All"
                  (selectedChange)="onSourcesChange($event)"
                  class="mt-1 block"
                />
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div>Power State</div>
                <app-multi-select
                  [options]="powerStateOptions"
                  [selected]="selectedPowerStates"
                  placeholder="All"
                  (selectedChange)="onPowerStateChange($event)"
                  class="mt-1 block"
                />
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guest OS</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr *ngIf="loading">
              <td colspan="6" class="px-4 py-8 text-center text-gray-400">Loading…</td>
            </tr>
            <tr *ngIf="!loading && rows.length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-gray-400">No results found.</td>
            </tr>
            <tr *ngFor="let row of rows" class="hover:bg-gray-50 transition-colors">
              <td class="px-4 py-2.5 font-mono text-xs text-blue-600 hover:underline">
                <a [routerLink]="['/inventory', row.hostname]">{{ row.hostname }}</a>
              </td>
              <td class="px-4 py-2.5">
                <div *ngIf="sortIps(row.vsphereIpv4).length; else emptyCell" class="flex flex-wrap gap-1">
                  <span *ngFor="let ip of sortIps(row.vsphereIpv4)"
                        class="inline-block px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 font-mono">
                    {{ ip }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-2.5">
                <div *ngIf="sortIps(row.nrIpv4).length; else emptyCell" class="flex flex-wrap gap-1">
                  <span *ngFor="let ip of sortIps(row.nrIpv4)"
                        class="inline-block px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 font-mono">
                    {{ ip }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-2.5">
                <div class="flex flex-wrap gap-1">
                  <span *ngIf="row.sources?.includes('vsphere')"
                        class="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">vsphere</span>
                  <span *ngIf="row.sources?.includes('newrelic')"
                        class="px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">newrelic</span>
                </div>
              </td>
              <td class="px-4 py-2.5">
                <span *ngIf="row.powerState" [ngClass]="powerStateClass(row.powerState)"
                      class="px-2 py-0.5 rounded-full text-xs font-medium">
                  {{ row.powerState }}
                </span>
                <span *ngIf="!row.powerState" class="text-gray-300">—</span>
              </td>
              <td class="px-4 py-2.5 text-gray-600 text-xs">{{ row.guestOs || '—' }}</td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div *ngIf="totalPages > 1" class="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
          <span>{{ pageStart }}–{{ pageEnd }} of {{ totalCount | number }}</span>
          <div class="flex items-center gap-2">
            <button (click)="goToPage(currentPage - 1)" [disabled]="currentPage === 0"
                    class="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              &lsaquo; Prev
            </button>
            <span>Page {{ currentPage + 1 }} / {{ totalPages }}</span>
            <button (click)="goToPage(currentPage + 1)" [disabled]="currentPage >= totalPages - 1"
                    class="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              Next &rsaquo;
            </button>
          </div>
          <select [(ngModel)]="pageSize" (ngModelChange)="onPageSizeChange()" class="text-sm border border-gray-300 rounded px-2 py-1">
            <option [value]="25">25 / page</option>
            <option [value]="50">50 / page</option>
            <option [value]="100">100 / page</option>
          </select>
        </div>
      </div>
    </div>

    <ng-template #emptyCell><span class="text-gray-300">—</span></ng-template>
  `
})
export class MissingFromCmdbComponent implements OnInit {
  private http = inject(HttpClient);
  private search$ = new Subject<string>();

  rows: Inventory[] = [];
  loading = false;
  totalCount = 0;
  totalPages = 0;
  currentPage = 0;
  pageSize = 25;
  searchQuery = '';
  selectedSources: string[] = [];
  selectedPowerStates: string[] = [];

  readonly sourceOptions = ['vsphere', 'newrelic'];
  readonly powerStateOptions = ['poweredOn', 'poweredOff', 'suspended'];

  get pageStart(): number { return this.currentPage * this.pageSize + 1; }
  get pageEnd(): number { return Math.min((this.currentPage + 1) * this.pageSize, this.totalCount); }

  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        this.searchQuery = q;
        this.currentPage = 0;
        return this.fetchPage();
      })
    ).subscribe(resp => this.applyResponse(resp));

    this.load();
  }

  private load(): void {
    this.loading = true;
    this.fetchPage().subscribe({
      next: resp => { this.applyResponse(resp); this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  private fetchPage() {
    let params = new HttpParams()
      .set('page', this.currentPage)
      .set('size', this.pageSize);
    if (this.searchQuery) params = params.set('search', this.searchQuery);
    if (this.selectedPowerStates.length === 1) params = params.set('powerState', this.selectedPowerStates[0]);
    if (this.selectedSources.length === 1) params = params.set('sources', this.selectedSources[0]);
    return this.http.get<PagedResponse<Inventory>>(
      `${environment.apiBaseUrl}/api/reports/missing-from-cmdb`, { params }
    );
  }

  private applyResponse(resp: PagedResponse<Inventory>): void {
    this.rows = resp.content;
    this.totalCount = resp.totalElements;
    this.totalPages = resp.totalPages;
  }

  onSearch(query: string): void { this.search$.next(query); }

  onSourcesChange(values: string[]): void {
    this.selectedSources = values;
    this.currentPage = 0;
    this.load();
  }

  onPowerStateChange(values: string[]): void {
    this.selectedPowerStates = values;
    this.currentPage = 0;
    this.load();
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.load();
  }

  onPageSizeChange(): void {
    this.currentPage = 0;
    this.load();
  }

  sortIps(raw: string | null | undefined): string[] {
    if (!raw) return [];
    return raw.split(',')
      .map(s => s.trim())
      .filter(s => s && !s.includes(':'))
      .sort((a, b) => this.ipToNum(a) - this.ipToNum(b));
  }

  private ipToNum(ip: string): number {
    return ip.split('.').reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
  }

  powerStateClass(state: string): string {
    if (state === 'poweredOn') return 'bg-green-100 text-green-700';
    if (state === 'poweredOff') return 'bg-gray-100 text-gray-600';
    if (state === 'suspended') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-600';
  }

  exportCsv(): void {
    let params = new HttpParams().set('page', 0).set('size', 10000);
    if (this.searchQuery) params = params.set('search', this.searchQuery);
    if (this.selectedPowerStates.length === 1) params = params.set('powerState', this.selectedPowerStates[0]);
    if (this.selectedSources.length === 1) params = params.set('sources', this.selectedSources[0]);

    this.http.get<PagedResponse<Inventory>>(
      `${environment.apiBaseUrl}/api/reports/missing-from-cmdb`, { params }
    ).subscribe(resp => {
      const headers = ['hostname', 'vsphereIpv4', 'nrIpv4', 'sources', 'powerState', 'guestOs'];
      const csvRows = [
        headers.join(','),
        ...resp.content.map(r => [
          r.hostname,
          r.vsphereIpv4 ?? '',
          r.nrIpv4 ?? '',
          r.sources ?? '',
          r.powerState ?? '',
          r.guestOs ?? ''
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      ];
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `missing-from-cmdb-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}
