import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { NewRelicService } from '../../core/services/newrelic.service';
import { NewRelicRecord } from '../../core/models/newrelic.model';
import { MultiSelectComponent } from '../../shared/components/multi-select/multi-select.component';

interface ColumnDef {
  key: keyof NewRelicRecord;
  label: string;
  visible: boolean;
}

// Precomputed display shape for one row — avoids calling formatCell/sortIps/formatMemory
// per cell per change-detection cycle.
interface NewRelicDisplayRow extends NewRelicRecord {
  _ipv4Sorted: string;
  _ipv6Sorted: string;
  _memoryFormatted: string;
  _createdAtFormatted: string;
  _updatedAtFormatted: string;
}

// Static sets used for O(1) column-type checks inside [class.*] bindings.
// Defined at module scope so they are not recreated per instance.
const NUMERIC_COLS = new Set<keyof NewRelicRecord>(['processorCount', 'coreCount', 'systemMemoryBytes']);
const IP_COLS      = new Set<keyof NewRelicRecord>(['ipv4Address', 'ipv6Address']);

@Component({
  selector: 'app-newrelic-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MultiSelectComponent],
  template: `
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-800">New Relic Hosts</h1>
      </div>

      <!-- Toolbar: record count + export + column picker -->
      <div class="bg-white rounded-lg shadow px-4 py-3 mb-4 flex items-center justify-between">
        <span class="text-sm text-gray-500">{{ totalElements }} records</span>

        <div class="flex items-center gap-2">
          <!-- Export CSV button -->
          <button (click)="exportCsv()"
                  class="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 focus:outline-none">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export CSV
          </button>

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
        </div><!-- end right-side flex -->
      </div>

      <!-- Table -->
      <div class="bg-white rounded-lg shadow overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th *ngFor="let col of visibleColumns; trackBy: trackByColKey"
                  class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap align-top">
                <div>{{ col.label }}</div>

                <!-- Inline filter: Hostname text input -->
                <div *ngIf="col.key === 'hostname'">
                  <input
                    [(ngModel)]="search"
                    (ngModelChange)="onSearchChange()"
                    placeholder="Filter..."
                    class="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none mt-1 font-normal normal-case tracking-normal"
                  />
                </div>

                <!-- Inline filter: Account ID multi-select -->
                <div *ngIf="col.key === 'accountId'">
                  <app-multi-select
                    [options]="accountIds"
                    [selected]="filterAccountIds"
                    placeholder="All"
                    (selectedChange)="filterAccountIds = $event; onFilter()">
                  </app-multi-select>
                </div>

                <!-- Inline filter: Linux Distro multi-select -->
                <div *ngIf="col.key === 'linuxDistribution'">
                  <app-multi-select
                    [options]="linuxDistroOptions"
                    [selected]="filterLinuxDistros"
                    placeholder="All"
                    (selectedChange)="filterLinuxDistros = $event; onFilter()">
                  </app-multi-select>
                </div>

              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr *ngFor="let host of displayItems; trackBy: trackByHostname" class="hover:bg-gray-50">
              <td *ngFor="let col of visibleColumns; trackBy: trackByColKey" class="px-4 py-3 whitespace-nowrap"
                  [class.font-medium]="col.key === 'hostname'"
                  [class.text-gray-900]="col.key === 'hostname'"
                  [class.text-gray-600]="col.key !== 'hostname'"
                  [class.text-right]="isNumericCol(col.key)"
                  [class.font-mono]="isIpCol(col.key)"
                  [class.text-xs]="isIpCol(col.key)">
                <ng-container [ngSwitch]="col.key">
                  <ng-container *ngSwitchCase="'systemMemoryBytes'">{{ host._memoryFormatted }}</ng-container>
                  <ng-container *ngSwitchCase="'ipv4Address'">{{ host._ipv4Sorted }}</ng-container>
                  <ng-container *ngSwitchCase="'ipv6Address'">{{ host._ipv6Sorted }}</ng-container>
                  <ng-container *ngSwitchCase="'createdAt'">{{ host._createdAtFormatted }}</ng-container>
                  <ng-container *ngSwitchCase="'updatedAt'">{{ host._updatedAtFormatted }}</ng-container>
                  <ng-container *ngSwitchDefault>{{ host[col.key] ?? '—' }}</ng-container>
                </ng-container>
              </td>
            </tr>
            <tr *ngIf="displayItems.length === 0">
              <td [attr.colspan]="visibleColumns.length || 1"
                  class="px-4 py-8 text-center text-gray-400">No New Relic records found</td>
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
            <span>{{ totalElements }} records</span>
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
export class NewRelicListComponent implements OnInit {
  private newRelicService = inject(NewRelicService);
  private destroyRef = inject(DestroyRef);

  displayItems: NewRelicDisplayRow[] = [];
  visibleColumns: ColumnDef[] = [];
  accountIds: string[] = [];
  linuxDistroOptions: string[] = [];
  totalElements = 0;
  totalPages = 0;
  currentPage = 0;
  pageSize = 25;
  search = '';
  filterAccountIds: string[] = [];
  filterLinuxDistros: string[] = [];
  showColumnPicker = false;

  // Subject that drives debounced search-triggered loads.
  private searchTrigger$ = new Subject<string>();

  // All available columns — initial order and visibility matches the requested defaults
  columns: ColumnDef[] = [
    { key: 'hostname',           label: 'Hostname',     visible: true  },
    { key: 'accountId',          label: 'Account ID',   visible: true  },
    { key: 'ipv4Address',        label: 'IPv4',         visible: true  },
    { key: 'processorCount',     label: 'Processors',   visible: true  },
    { key: 'coreCount',          label: 'Cores',        visible: true  },
    { key: 'systemMemoryBytes',  label: 'Memory (GB)',  visible: true  },
    { key: 'linuxDistribution',  label: 'Linux Distro', visible: true  },
    { key: 'location',           label: 'Location',     visible: false },
    { key: 'environment',        label: 'Environment',  visible: false },
    { key: 'team',               label: 'Team',         visible: false },
    { key: 'service',            label: 'Service',      visible: false },
    { key: 'ipv6Address',        label: 'IPv6',         visible: false },
  ];

  private readonly defaultColumns = this.columns.map(c => ({ key: c.key, visible: c.visible }));

  ngOnInit(): void {
    // Seed the cached visible-column list before first render.
    this.refreshVisibleColumns();

    // Wire up the debounced search pipeline. switchMap cancels any in-flight request
    // before starting a new one. takeUntilDestroyed cleans up when the component is destroyed.
    this.searchTrigger$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(term => this.newRelicService.list({
          search: term,
          accountIds: this.filterAccountIds,
          linuxDistros: this.filterLinuxDistros,
          page: this.currentPage,
          size: this.pageSize
        })),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(res => {
        this.totalElements = res.totalElements;
        this.totalPages = res.totalPages;
        this.displayItems = res.content.map(host => this.toDisplayRow(host));
      });

    this.loadImmediate();

    this.newRelicService.getAccountIds()
      .pipe(
        catchError(err => { console.error('Failed to load NR account IDs', err); return of([]); }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(ids => this.accountIds = ids);

    this.newRelicService.getLinuxDistros()
      .pipe(
        catchError(err => { console.error('Failed to load NR linux distros', err); return of([]); }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(distros => this.linuxDistroOptions = distros);
  }

  // Called for filter/page changes that should load immediately (no debounce needed).
  loadImmediate(): void {
    this.newRelicService.list({
      search: this.search,
      accountIds: this.filterAccountIds,
      linuxDistros: this.filterLinuxDistros,
      page: this.currentPage,
      size: this.pageSize
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(res => {
        this.totalElements = res.totalElements;
        this.totalPages = res.totalPages;
        this.displayItems = res.content.map(host => this.toDisplayRow(host));
      });
  }

  // Keystroke handler — feeds the debounced pipeline.
  onSearchChange(): void {
    this.currentPage = 0;
    this.searchTrigger$.next(this.search);
  }

  onFilter(): void { this.currentPage = 0; this.loadImmediate(); }
  onPageSizeChange(): void { this.currentPage = 0; this.loadImmediate(); }

  prevPage(): void { this.currentPage--; this.loadImmediate(); }
  nextPage(): void { this.currentPage++; this.loadImmediate(); }

  // Update the cached visible-column list. Called when visibility or order changes.
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

  exportCsv(): void {
    this.newRelicService.list({
      search: this.search,
      accountIds: this.filterAccountIds,
      linuxDistros: this.filterLinuxDistros,
      page: 0,
      size: 10000
    }).subscribe(res => {
      const headers = this.columns.map(c => c.label);
      const rows = [
        headers.join(','),
        ...res.content.map(host => {
          const d = this.toDisplayRow(host);
          return this.columns.map(c => {
            let v: string;
            switch (c.key) {
              case 'ipv4Address':       v = d._ipv4Sorted; break;
              case 'ipv6Address':       v = d._ipv6Sorted; break;
              case 'systemMemoryBytes': v = d._memoryFormatted; break;
              case 'createdAt':         v = d._createdAtFormatted; break;
              case 'updatedAt':         v = d._updatedAtFormatted; break;
              default:                  v = String(host[c.key] ?? '');
            }
            return `"${v.replace(/"/g, '""')}"`;
          }).join(',');
        })
      ];
      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `newrelic-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // O(1) Set lookups — replaces per-cell method calls in [class.*] bindings.
  isNumericCol(key: keyof NewRelicRecord): boolean { return NUMERIC_COLS.has(key); }
  isIpCol(key: keyof NewRelicRecord): boolean      { return IP_COLS.has(key); }

  trackByHostname(_index: number, row: NewRelicDisplayRow): string {
    return row.hostname;
  }

  trackByColKey(_index: number, col: ColumnDef): string {
    return col.key;
  }

  // Convert a raw API record into a display row by precomputing all derived values once.
  private toDisplayRow(host: NewRelicRecord): NewRelicDisplayRow {
    return {
      ...host,
      _ipv4Sorted:        this.sortIps(host.ipv4Address),
      _ipv6Sorted:        this.sortIps(host.ipv6Address),
      _memoryFormatted:   host.systemMemoryBytes != null ? (host.systemMemoryBytes / 1073741824).toFixed(1) : '—',
      _createdAtFormatted: host.createdAt ? new Date(host.createdAt).toLocaleString() : '—',
      _updatedAtFormatted: host.updatedAt ? new Date(host.updatedAt).toLocaleString() : '—',
    };
  }

  private sortIps(value: string | undefined): string {
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
