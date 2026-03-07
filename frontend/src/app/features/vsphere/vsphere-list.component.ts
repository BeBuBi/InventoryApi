import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { VsphereService } from '../../core/services/vsphere.service';
import { VsphereRecord } from '../../core/models/vsphere.model';

interface ColumnDef {
  key: keyof VsphereRecord;
  label: string;
  visible: boolean;
}

// Precomputed display shape for one row — avoids calling formatCell/sortIps per cell per CD cycle.
interface VsphereDisplayRow extends VsphereRecord {
  _ipv4Sorted: string;
  _ipv6Sorted: string;
  _lastSyncedAtFormatted: string;
  _createdAtFormatted: string;
  _updatedAtFormatted: string;
  _powerStateClass: string;
}

@Component({
  selector: 'app-vsphere-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-800">vSphere VMs</h1>
      </div>

      <!-- Filters + Column Picker toggle -->
      <div class="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-3 items-center">
        <input [(ngModel)]="search" (ngModelChange)="onSearchChange()" placeholder="Search hostname..."
               class="border border-gray-300 rounded px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select [(ngModel)]="filterPowerState" (ngModelChange)="onFilter()"
                class="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
          <option value="">All Power States</option>
          <option value="poweredOn">Powered On</option>
          <option value="poweredOff">Powered Off</option>
          <option value="suspended">Suspended</option>
        </select>

        <span class="text-sm text-gray-500">{{ totalElements }} records</span>

        <!-- Column picker button -->
        <div class="relative ml-auto">
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
                          class="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-xs">▲</button>
                  <button (click)="moveColumn(i, 1)" [disabled]="i === columns.length - 1"
                          class="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-xs">▼</button>
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
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr *ngFor="let vm of displayItems; trackBy: trackByHostname" class="hover:bg-gray-50">
              <td *ngFor="let col of visibleColumns; trackBy: trackByColKey"
                  class="px-4 py-3 whitespace-nowrap"
                  [class.font-medium]="col.key === 'hostname'"
                  [class.text-gray-600]="col.key !== 'hostname'"
                  [class.font-mono]="col.key === 'ipv4Address' || col.key === 'ipv6Address'"
                  [class.text-xs]="col.key === 'ipv4Address' || col.key === 'ipv6Address'">
                <ng-container [ngSwitch]="col.key">
                  <ng-container *ngSwitchCase="'powerState'">
                    <span [class]="vm._powerStateClass"
                          class="px-2 py-0.5 rounded text-xs font-medium">{{ vm.powerState || '—' }}</span>
                  </ng-container>
                  <ng-container *ngSwitchCase="'ipv4Address'">{{ vm._ipv4Sorted }}</ng-container>
                  <ng-container *ngSwitchCase="'ipv6Address'">{{ vm._ipv6Sorted }}</ng-container>
                  <ng-container *ngSwitchCase="'lastSyncedAt'">{{ vm._lastSyncedAtFormatted }}</ng-container>
                  <ng-container *ngSwitchCase="'createdAt'">{{ vm._createdAtFormatted }}</ng-container>
                  <ng-container *ngSwitchCase="'updatedAt'">{{ vm._updatedAtFormatted }}</ng-container>
                  <ng-container *ngSwitchDefault>{{ vm[col.key] ?? '—' }}</ng-container>
                </ng-container>
              </td>
            </tr>
            <tr *ngIf="displayItems.length === 0">
              <td [attr.colspan]="visibleColumns.length || 1"
                  class="px-4 py-8 text-center text-gray-400">No vSphere records found</td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div class="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
          <div class="flex items-center gap-2">
            <span class="text-gray-500">Rows:</span>
            <select [(ngModel)]="pageSize" (ngModelChange)="onPageSizeChange()"
                    class="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none">
              <option [value]="20">20</option>
              <option [value]="50">50</option>
              <option [value]="100">100</option>
              <option [value]="200">200</option>
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
export class VsphereListComponent implements OnInit {
  private vsphereService = inject(VsphereService);
  private destroyRef = inject(DestroyRef);

  displayItems: VsphereDisplayRow[] = [];
  visibleColumns: ColumnDef[] = [];
  totalElements = 0;
  totalPages = 0;
  currentPage = 0;
  pageSize = 20;
  search = '';
  filterPowerState = '';
  showColumnPicker = false;

  // Subject that drives debounced search-triggered loads.
  private searchTrigger$ = new Subject<void>();

  // All available columns — initial order and visibility matches the requested defaults
  columns: ColumnDef[] = [
    { key: 'hostname',     label: 'Hostname',     visible: true  },
    { key: 'ipv4Address',  label: 'IPv4',         visible: true  },
    { key: 'cpuCount',     label: 'CPU Count',    visible: true  },
    { key: 'cpuCores',     label: 'CPU Cores',    visible: true  },
    { key: 'memoryGb',     label: 'Memory (GB)',  visible: true  },
    { key: 'guestOs',      label: 'Guest OS',     visible: true  },
    { key: 'vmName',       label: 'VM Name',      visible: false },
    { key: 'memoryMb',     label: 'Memory (MB)',  visible: false },
    { key: 'powerState',   label: 'Power State',  visible: false },
    { key: 'toolsStatus',  label: 'Tools Status', visible: false },
    { key: 'ipv6Address',  label: 'IPv6',         visible: false },
    { key: 'lastSyncedAt', label: 'Last Synced',  visible: false },
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
        switchMap(() => this.vsphereService.list({
          search: this.search,
          powerState: this.filterPowerState,
          page: this.currentPage,
          size: this.pageSize
        })),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(res => {
        this.totalElements = res.totalElements;
        this.totalPages = res.totalPages;
        this.displayItems = res.content.map(vm => this.toDisplayRow(vm));
      });

    this.loadImmediate();
  }

  // Called for filter/page changes that should load immediately (no debounce needed).
  loadImmediate(): void {
    this.vsphereService.list({
      search: this.search,
      powerState: this.filterPowerState,
      page: this.currentPage,
      size: this.pageSize
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(res => {
        this.totalElements = res.totalElements;
        this.totalPages = res.totalPages;
        this.displayItems = res.content.map(vm => this.toDisplayRow(vm));
      });
  }

  // Keystroke handler — feeds the debounced pipeline.
  onSearchChange(): void {
    this.currentPage = 0;
    this.searchTrigger$.next();
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

  trackByHostname(_index: number, row: VsphereDisplayRow): string {
    return row.hostname;
  }

  trackByColKey(_index: number, col: ColumnDef): string {
    return col.key;
  }

  // Convert a raw API record into a display row by precomputing all derived values once.
  private toDisplayRow(vm: VsphereRecord): VsphereDisplayRow {
    return {
      ...vm,
      _ipv4Sorted: this.sortIps(vm.ipv4Address),
      _ipv6Sorted: this.sortIps(vm.ipv6Address),
      _lastSyncedAtFormatted: vm.lastSyncedAt ? new Date(vm.lastSyncedAt).toLocaleString() : '—',
      _createdAtFormatted:    vm.createdAt    ? new Date(vm.createdAt).toLocaleString()    : '—',
      _updatedAtFormatted:    vm.updatedAt    ? new Date(vm.updatedAt).toLocaleString()    : '—',
      _powerStateClass: this.powerStateClass(vm.powerState),
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

  private powerStateClass(state?: string): string {
    return { poweredOn: 'bg-green-100 text-green-800', poweredOff: 'bg-gray-100 text-gray-600',
      suspended: 'bg-yellow-100 text-yellow-800' }[state ?? ''] ?? 'bg-gray-100 text-gray-500';
  }

}
