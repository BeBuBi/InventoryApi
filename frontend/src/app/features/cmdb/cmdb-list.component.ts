import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { CmdbService } from '../../core/services/cmdb.service';
import { CmdbRecord } from '../../core/models/cmdb.model';
import { MultiSelectComponent } from '../../shared/components/multi-select/multi-select.component';

interface ColumnDef {
  key: keyof CmdbRecord;
  label: string;
  visible: boolean;
}

// Precomputed display shape for one row — avoids calling formatCell per cell per CD cycle.
interface CmdbDisplayRow extends CmdbRecord {
  _lastSyncedAtFormatted: string;
  _createdAtFormatted: string;
  _updatedAtFormatted: string;
  _operationalStatusLabel: string;
  _operationalStatusClass: string;
}

@Component({
  selector: 'app-cmdb-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MultiSelectComponent],
  template: `
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-800">CMDB Assets</h1>
      </div>

      <!-- Toolbar: record count left, column picker right -->
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

                <!-- Inline filter: OS Version multi-select -->
                <div *ngIf="col.key === 'osVersion'">
                  <app-multi-select
                    [options]="osVersionOptions"
                    [selected]="filterOsVersions"
                    placeholder="All"
                    (selectedChange)="filterOsVersions = $event; onFilter()">
                  </app-multi-select>
                </div>

                <!-- Inline filter: Operational Status multi-select -->
                <div *ngIf="col.key === 'operationalStatus'">
                  <app-multi-select
                    [options]="opStatusOptions"
                    [selected]="filterOpStatuses"
                    [labelFn]="operationalStatusLabel"
                    placeholder="All"
                    (selectedChange)="filterOpStatuses = $event; onFilter()">
                  </app-multi-select>
                </div>

              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr *ngFor="let asset of displayItems; trackBy: trackByHostname" class="hover:bg-gray-50">
              <td *ngFor="let col of visibleColumns; trackBy: trackByColKey"
                  class="px-4 py-3 whitespace-nowrap"
                  [class.font-medium]="col.key === 'hostname'"
                  [class.text-gray-600]="col.key !== 'hostname'"
                  [class.font-mono]="col.key === 'ipAddress'"
                  [class.text-xs]="col.key === 'ipAddress'">
                <ng-container [ngSwitch]="col.key">
                  <ng-container *ngSwitchCase="'operationalStatus'">
                    <span [class]="asset._operationalStatusClass"
                          class="px-2 py-0.5 rounded text-xs font-medium">{{ asset._operationalStatusLabel }}</span>
                  </ng-container>
                  <ng-container *ngSwitchCase="'lastSyncedAt'">{{ asset._lastSyncedAtFormatted }}</ng-container>
                  <ng-container *ngSwitchCase="'createdAt'">{{ asset._createdAtFormatted }}</ng-container>
                  <ng-container *ngSwitchCase="'updatedAt'">{{ asset._updatedAtFormatted }}</ng-container>
                  <ng-container *ngSwitchDefault>{{ asset[col.key] ?? '—' }}</ng-container>
                </ng-container>
              </td>
            </tr>
            <tr *ngIf="displayItems.length === 0">
              <td [attr.colspan]="visibleColumns.length || 1"
                  class="px-4 py-8 text-center text-gray-400">No CMDB records found</td>
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
export class CmdbListComponent implements OnInit {
  private cmdbService = inject(CmdbService);
  private destroyRef = inject(DestroyRef);

  displayItems: CmdbDisplayRow[] = [];
  visibleColumns: ColumnDef[] = [];
  osVersionOptions: string[] = [];
  opStatusOptions: string[] = [];
  totalElements = 0;
  totalPages = 0;
  currentPage = 0;
  pageSize = 25;
  search = '';
  filterOsVersions: string[] = [];
  filterOpStatuses: string[] = [];
  showColumnPicker = false;

  // Subject that drives debounced search-triggered loads.
  private searchTrigger$ = new Subject<string>();

  // All available columns — initial order and visibility matches the requested defaults
  columns: ColumnDef[] = [
    { key: 'hostname',          label: 'Hostname',          visible: true  },
    { key: 'ipAddress',         label: 'IP Address',        visible: true  },
    { key: 'os',                label: 'OS',                visible: false },
    { key: 'osVersion',         label: 'OS Version',        visible: true  },
    { key: 'location',          label: 'Location',          visible: false },
    { key: 'department',        label: 'Department',        visible: false },
    { key: 'environment',       label: 'Environment',       visible: false },
    { key: 'operationalStatus', label: 'Op. Status',        visible: true  },
    { key: 'classification',    label: 'Classification',    visible: false },
    { key: 'lastSyncedAt',      label: 'Last Synced',       visible: false },
  ];

  private readonly defaultColumns = this.columns.map(c => ({ key: c.key, visible: c.visible }));

  ngOnInit(): void {
    // Seed the cached visible-column list before first render.
    this.refreshVisibleColumns();

    // Load distinct OS version options for the inline filter dropdown.
    this.cmdbService.getOsVersions()
      .pipe(
        catchError(err => { console.error('Failed to load OS versions', err); return of([]); }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(versions => { this.osVersionOptions = versions; });

    // Load distinct operational status options for the inline filter dropdown.
    this.cmdbService.listOperationalStatuses()
      .pipe(
        catchError(err => { console.error('Failed to load operational statuses', err); return of([]); }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(statuses => { this.opStatusOptions = statuses; });

    // Wire up the debounced search pipeline. switchMap cancels any in-flight request
    // before starting a new one. takeUntilDestroyed cleans up when the component is destroyed.
    this.searchTrigger$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(term => this.cmdbService.list({
          search: term,
          opStatuses: this.filterOpStatuses,
          osVersions: this.filterOsVersions,
          page: this.currentPage,
          size: this.pageSize
        })),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(res => {
        this.totalElements = res.totalElements;
        this.totalPages = res.totalPages;
        this.displayItems = res.content.map(asset => this.toDisplayRow(asset));
      });

    this.loadImmediate();
  }

  // Called for filter/page changes that should load immediately (no debounce needed).
  loadImmediate(): void {
    this.cmdbService.list({
      search: this.search,
      opStatuses: this.filterOpStatuses,
      osVersions: this.filterOsVersions,
      page: this.currentPage,
      size: this.pageSize
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(res => {
        this.totalElements = res.totalElements;
        this.totalPages = res.totalPages;
        this.displayItems = res.content.map(asset => this.toDisplayRow(asset));
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

  trackByHostname(_index: number, row: CmdbDisplayRow): string {
    return row.hostname;
  }

  trackByColKey(_index: number, col: ColumnDef): string {
    return col.key;
  }

  // Bound method passed to app-multi-select [labelFn] for the op-status dropdown so
  // the panel shows human-readable labels while the backing values stay numeric strings.
  operationalStatusLabel = (status: string): string => {
    switch (status) {
      case '1': return 'Operational';
      case '2': return 'Repair in Progress';
      case '3': return 'Do Not Use';
      case '6': return 'Retired';
      case '7': return 'Stolen';
      default:  return status;
    }
  };

  operationalStatusClass(status?: string): string {
    switch (status) {
      case '1': return 'bg-green-100 text-green-800';
      case '2': return 'bg-yellow-100 text-yellow-800';
      case '3': return 'bg-red-100 text-red-800';
      case '6': return 'bg-gray-100 text-gray-600';
      case '7': return 'bg-red-100 text-red-800';
      default:  return 'bg-gray-100 text-gray-500';
    }
  }

  // Convert a raw API record into a display row by precomputing all derived values once.
  toDisplayRow(asset: CmdbRecord): CmdbDisplayRow {
    return {
      ...asset,
      _lastSyncedAtFormatted: asset.lastSyncedAt ? new Date(asset.lastSyncedAt).toLocaleString() : '—',
      _createdAtFormatted:    asset.createdAt    ? new Date(asset.createdAt).toLocaleString()    : '—',
      _updatedAtFormatted:    asset.updatedAt    ? new Date(asset.updatedAt).toLocaleString()    : '—',
      _operationalStatusLabel: this.operationalStatusLabel(asset.operationalStatus ?? ''),
      _operationalStatusClass: this.operationalStatusClass(asset.operationalStatus),
    };
  }

}
