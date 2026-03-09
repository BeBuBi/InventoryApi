import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InventoryService } from '../../core/services/inventory.service';
import { Inventory, InventoryCounts } from '../../core/models/inventory.model';
import { PagedResponse } from '../../core/models/paged-response.model';

interface ColumnDef {
  key: keyof Inventory;
  label: string;
  visible: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-white rounded-lg shadow p-4">
          <p class="text-sm text-gray-500">Total Hosts</p>
          <p class="text-3xl font-bold text-gray-800">{{ counts?.total ?? '—' }}</p>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <p class="text-sm text-gray-500">In vSphere</p>
          <p class="text-3xl font-bold text-blue-600">{{ counts?.vsphere ?? '—' }}</p>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <p class="text-sm text-gray-500">In New Relic</p>
          <p class="text-3xl font-bold text-green-600">{{ counts?.newrelic ?? '—' }}</p>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <p class="text-sm text-gray-500">In CMDB</p>
          <p class="text-3xl font-bold text-orange-600">{{ counts?.cmdb ?? '—' }}</p>
        </div>
      </div>

      <!-- Toolbar: record count + column picker -->
      <div class="bg-white rounded-lg shadow px-4 py-3 mb-4 flex items-center justify-between">
        <span class="text-sm text-gray-500">{{ totalElements }} records</span>

        <!-- Column picker button -->
        <div class="relative">
          <button (click)="showColumnPicker = !showColumnPicker"
                  class="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 focus:outline-none">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
            Columns
            <span class="bg-blue-100 text-blue-700 text-xs font-medium px-1.5 py-0.5 rounded">
              {{ visibleColumns.length }}
            </span>
          </button>

          <!-- Dropdown panel -->
          <div *ngIf="showColumnPicker"
               class="absolute right-0 top-10 z-20 bg-white border border-gray-200 rounded-lg shadow-lg w-64 p-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Show / Reorder Columns</span>
              <button (click)="showColumnPicker = false" class="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
            </div>
            <div class="space-y-1 max-h-80 overflow-y-auto pr-1">
              <div *ngFor="let col of columns; let i = index"
                   class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50">
                <!-- Up / Down -->
                <div class="flex flex-col gap-0.5">
                  <button (click)="moveColumn(i, -1)" [disabled]="i === 0"
                          class="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-xs">&#9650;</button>
                  <button (click)="moveColumn(i, 1)" [disabled]="i === columns.length - 1"
                          class="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-xs">&#9660;</button>
                </div>
                <!-- Checkbox -->
                <input type="checkbox" [(ngModel)]="col.visible" (ngModelChange)="refreshVisibleColumns()"
                       class="w-4 h-4 accent-blue-600 cursor-pointer" />
                <span class="text-sm text-gray-700 select-none cursor-pointer"
                      (click)="col.visible = !col.visible; refreshVisibleColumns()">{{ col.label }}</span>
              </div>
            </div>
            <div class="mt-3 pt-2 border-t border-gray-100 flex justify-between">
              <button (click)="resetColumns()"
                      class="text-xs text-gray-400 hover:text-gray-600">Reset defaults</button>
              <span class="text-xs text-gray-400">{{ visibleColumns.length }} of {{ columns.length }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Asset table -->
      <div class="bg-white rounded-lg shadow overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm" aria-label="Aggregated asset inventory">
          <thead class="bg-gray-50">
            <tr>
              <!-- Hostname is always first and always visible -->
              <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap align-top">
                <div>Hostname</div>
                <div>
                  <input
                    [(ngModel)]="search"
                    (ngModelChange)="onSearchChange()"
                    placeholder="Filter..."
                    class="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none mt-1 font-normal normal-case tracking-normal"
                  />
                </div>
              </th>
              <th *ngFor="let col of visibleColumns; trackBy: trackByColKey"
                  scope="col"
                  class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap align-top">
                <div>{{ col.label }}</div>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr *ngIf="loading">
              <td [attr.colspan]="visibleColumns.length + 1" class="px-4 py-8 text-center text-gray-400">Loading...</td>
            </tr>
            <ng-container *ngIf="!loading">
              <tr *ngFor="let item of items; trackBy: trackByHostname" class="hover:bg-gray-50">
                <!-- Fixed hostname column -->
                <td class="px-4 py-3 whitespace-nowrap">
                  <a [routerLink]="['/inventory', item.hostname]"
                     class="text-blue-600 hover:underline font-medium">{{ item.hostname }}</a>
                </td>
                <!-- Dynamic columns -->
                <td *ngFor="let col of visibleColumns; trackBy: trackByColKey"
                    class="px-4 py-3 whitespace-nowrap">
                  <ng-container [ngSwitch]="col.key">

                    <!-- cmdbIpAddress — orange pill -->
                    <ng-container *ngSwitchCase="'cmdbIpAddress'">
                      <span *ngIf="item.cmdbIpAddress"
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        {{ sortIps(item.cmdbIpAddress) }}
                      </span>
                      <span *ngIf="!item.cmdbIpAddress" class="text-gray-400">—</span>
                    </ng-container>

                    <!-- vsphereIpv4 — blue pill -->
                    <ng-container *ngSwitchCase="'vsphereIpv4'">
                      <span *ngIf="item.vsphereIpv4"
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {{ sortIps(item.vsphereIpv4) }}
                      </span>
                      <span *ngIf="!item.vsphereIpv4" class="text-gray-400">—</span>
                    </ng-container>

                    <!-- nrIpv4 — green pill -->
                    <ng-container *ngSwitchCase="'nrIpv4'">
                      <span *ngIf="item.nrIpv4"
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {{ sortIps(item.nrIpv4) }}
                      </span>
                      <span *ngIf="!item.nrIpv4" class="text-gray-400">—</span>
                    </ng-container>

                    <!-- sources — source badge rendering -->
                    <ng-container *ngSwitchCase="'sources'">
                      <span *ngFor="let src of parseSources(item.sources)"
                            [class]="sourceBadgeClass(src)"
                            class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mr-1">
                        {{ sourceLabel(src) }}
                      </span>
                      <span *ngIf="!item.sources" class="text-gray-400">—</span>
                    </ng-container>

                    <!-- powerState — colored badge -->
                    <ng-container *ngSwitchCase="'powerState'">
                      <span *ngIf="item.powerState"
                            [class]="powerStateClass(item.powerState)"
                            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium">
                        {{ item.powerState }}
                      </span>
                      <span *ngIf="!item.powerState" class="text-gray-400">—</span>
                    </ng-container>

                    <!-- operationalStatus — colored badge -->
                    <ng-container *ngSwitchCase="'operationalStatus'">
                      <span *ngIf="item.operationalStatus"
                            [class]="opStatusClass(item.operationalStatus)"
                            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium">
                        {{ item.operationalStatus }}
                      </span>
                      <span *ngIf="!item.operationalStatus" class="text-gray-400">—</span>
                    </ng-container>

                    <!-- All other columns — plain text -->
                    <ng-container *ngSwitchDefault>
                      <span class="text-gray-600">{{ item[col.key] ?? '—' }}</span>
                    </ng-container>

                  </ng-container>
                </td>
              </tr>
              <tr *ngIf="items.length === 0">
                <td [attr.colspan]="visibleColumns.length + 1" class="px-4 py-8 text-center text-gray-400">No records found</td>
              </tr>
            </ng-container>
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
            <span>{{ totalElements }} total hosts</span>
          </div>
          <div class="flex gap-2">
            <button (click)="prevPage()" [disabled]="currentPage === 0"
                    class="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <span class="px-3 py-1">Page {{ currentPage + 1 }} of {{ totalPages }}</span>
            <button (click)="nextPage()" [disabled]="currentPage >= totalPages - 1"
                    class="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  private inventoryService = inject(InventoryService);
  private destroyRef: DestroyRef = inject(DestroyRef);

  private searchTrigger$ = new Subject<string>();

  items: Inventory[] = [];
  counts?: InventoryCounts;
  totalElements = 0;
  totalPages = 0;
  currentPage = 0;
  pageSize = 25;
  search = '';
  loading = false;
  showColumnPicker = false;

  // All pickable columns (hostname is fixed — not in this array).
  columns: ColumnDef[] = [
    { key: 'vsphereIpv4',      label: 'IP (vSphere)',        visible: true  },
    { key: 'nrIpv4',           label: 'IP (New Relic)',      visible: true  },
    { key: 'cmdbIpAddress',    label: 'IP (CMDB)',          visible: true  },
    { key: 'sources',          label: 'Sources',             visible: true  },
    { key: 'powerState',       label: 'Power State',         visible: false },
    { key: 'operationalStatus',label: 'Op. Status',          visible: false },
    { key: 'guestOs',          label: 'Guest OS',            visible: false },
    { key: 'os',               label: 'OS',                  visible: false },
    { key: 'cmdbEnvironment',  label: 'Environment (CMDB)',  visible: false },
    { key: 'nrEnvironment',    label: 'Environment (NR)',    visible: false },
    { key: 'cmdbLocation',     label: 'Location (CMDB)',     visible: false },
    { key: 'nrLocation',       label: 'Location (NR)',       visible: false },
    { key: 'team',             label: 'Team',                visible: false },
    { key: 'service',          label: 'Service',             visible: false },
  ];

  private readonly defaultColumns = this.columns.map(c => ({ key: c.key, visible: c.visible }));

  visibleColumns: ColumnDef[] = [];

  ngOnInit(): void {
    this.refreshVisibleColumns();

    this.inventoryService.getCounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: c => this.counts = c });

    this.searchTrigger$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => {
        this.loading = true;
        return this.inventoryService.list({
          search: term,
          page: this.currentPage,
          size: this.pageSize
        });
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res: PagedResponse<Inventory>) => {
        this.items = res.content;
        this.totalElements = res.totalElements;
        this.totalPages = res.totalPages;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });

    this.load();
  }

  onSearchChange(): void {
    this.currentPage = 0;
    this.searchTrigger$.next(this.search);
  }

  load(): void {
    this.loading = true;
    this.inventoryService.list({
      search: this.search,
      page: this.currentPage,
      size: this.pageSize
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: PagedResponse<Inventory>) => {
        this.items = res.content;
        this.totalElements = res.totalElements;
        this.totalPages = res.totalPages;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  onPageSizeChange(): void { this.currentPage = 0; this.load(); }

  prevPage(): void { this.currentPage--; this.load(); }
  nextPage(): void { this.currentPage++; this.load(); }

  refreshVisibleColumns(): void {
    this.visibleColumns = this.columns.filter(c => c.visible);
  }

  moveColumn(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= this.columns.length) return;
    [this.columns[index], this.columns[target]] = [this.columns[target], this.columns[index]];
    this.refreshVisibleColumns();
  }

  resetColumns(): void {
    const ordered = this.defaultColumns.map(d => this.columns.find(c => c.key === d.key)!);
    ordered.forEach((col, i) => { col.visible = this.defaultColumns[i].visible; });
    this.columns = ordered;
    this.refreshVisibleColumns();
  }

  trackByHostname(_index: number, item: Inventory): string {
    return item.hostname;
  }

  trackByColKey(_index: number, col: ColumnDef): string {
    return col.key;
  }

  parseSources(sources?: string): string[] {
    if (!sources) return [];
    return sources.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  sourceLabel(src: string): string {
    return ({ vsphere: 'VS', newrelic: 'NR', cmdb: 'CMDB' } as Record<string, string>)[src] ?? src;
  }

  sourceBadgeClass(src: string): string {
    return ({
      vsphere: 'bg-blue-100 text-blue-800',
      newrelic: 'bg-green-100 text-green-800',
      cmdb: 'bg-orange-100 text-orange-800'
    } as Record<string, string>)[src] ?? 'bg-gray-100 text-gray-600';
  }

  powerStateClass(state?: string): string {
    return ({
      poweredOn:  'bg-green-100 text-green-800',
      poweredOff: 'bg-gray-100 text-gray-600',
      suspended:  'bg-yellow-100 text-yellow-800',
    } as Record<string, string>)[state ?? ''] ?? 'bg-gray-100 text-gray-500';
  }

  opStatusClass(status?: string): string {
    const s = (status ?? '').toLowerCase();
    if (s === 'operational' || s === 'in service') return 'bg-green-100 text-green-800';
    if (s === 'maintenance')                        return 'bg-yellow-100 text-yellow-800';
    if (s === 'decommissioned' || s === 'retired')  return 'bg-gray-100 text-gray-500';
    return 'bg-gray-100 text-gray-600';
  }

  sortIps(value: string | undefined): string {
    if (!value || value.trim() === '') return '—';
    const parts = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const ipv4Re = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    parts.sort((a, b) => {
      const ma = ipv4Re.exec(a);
      const mb = ipv4Re.exec(b);
      if (ma && mb) {
        for (let i = 1; i <= 4; i++) {
          const diff = parseInt(ma[i], 10) - parseInt(mb[i], 10);
          if (diff !== 0) return diff;
        }
        return 0;
      }
      if (ma) return -1;
      if (mb) return 1;
      return a.localeCompare(b);
    });
    return parts.join(', ');
  }
}
