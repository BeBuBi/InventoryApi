import { Component, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NewRelicService } from '../../core/services/newrelic.service';
import { NewRelicRecord } from '../../core/models/newrelic.model';
import { SyncStatus } from '../../core/models/sync-schedule.model';

@Component({
  selector: 'app-newrelic-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-800">New Relic Hosts</h1>
        <div class="flex items-center gap-3">
          <span *ngIf="syncStatus" [class]="syncStatusClass(syncStatus.status)"
                class="text-xs font-medium px-2 py-1 rounded">{{ syncStatus.status }}</span>
          <button (click)="triggerSync()"
                  class="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                  [disabled]="syncStatus?.status === 'running'">
            Sync Now
          </button>
        </div>
      </div>

      <!-- Filters + Column Picker -->
      <div class="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap items-center gap-3">
        <input [(ngModel)]="search" (ngModelChange)="onFilter()" placeholder="Search hostname..."
               class="border border-gray-300 rounded px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select [(ngModel)]="filterEnv" (ngModelChange)="onFilter()"
                class="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
          <option value="">All Environments</option>
          <option *ngFor="let env of environments" [value]="env">{{ env }}</option>
        </select>
        <span class="text-sm text-gray-500">{{ totalElements }} records</span>

<!-- Columns button and picker panel -->
        <div class="relative ml-auto" id="col-picker-root">
          <button
            (click)="toggleColPicker($event)"
            class="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-haspopup="true"
            [attr.aria-expanded]="showColPicker"
            aria-controls="col-picker-panel"
          >
            <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Columns
            <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
              {{ visibleColCount }}
            </span>
          </button>

          <!-- Picker panel -->
          <div
            *ngIf="showColPicker"
            id="col-picker-panel"
            role="dialog"
            aria-label="Toggle column visibility"
            class="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-md z-20 py-1"
          >
            <div class="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Visible Columns</span>
              <button
                (click)="showColPicker = false"
                class="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                aria-label="Close column picker"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <ul class="py-1" role="list">
              <!-- Hostname: always visible, disabled -->
              <li class="flex items-center gap-2 px-3 py-2 opacity-60 cursor-not-allowed select-none">
                <input type="checkbox" checked disabled
                       class="h-4 w-4 rounded border-gray-300 text-blue-600"
                       id="col-hostname"
                       aria-label="Hostname always visible" />
                <label for="col-hostname" class="text-sm text-gray-700 cursor-not-allowed">Hostname</label>
                <span class="ml-auto text-xs text-gray-400 italic">always on</span>
              </li>

              <li *ngFor="let col of colDefs" class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  [(ngModel)]="cols[col.key]"
                  [id]="'col-' + col.key"
                  class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  [attr.aria-label]="'Toggle ' + col.label + ' column'"
                />
                <label [for]="'col-' + col.key" class="text-sm text-gray-700 cursor-pointer select-none flex-1">
                  {{ col.label }}
                </label>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Hostname</th>
                <th *ngIf="cols['accountId']"      class="px-4 py-3 text-left  text-xs font-medium text-gray-500 uppercase tracking-wide">Account ID</th>
                <th *ngIf="cols['location']"       class="px-4 py-3 text-left  text-xs font-medium text-gray-500 uppercase tracking-wide">Location</th>
                <th *ngIf="cols['environment']"    class="px-4 py-3 text-left  text-xs font-medium text-gray-500 uppercase tracking-wide">Environment</th>
                <th *ngIf="cols['team']"           class="px-4 py-3 text-left  text-xs font-medium text-gray-500 uppercase tracking-wide">Team</th>
                <th *ngIf="cols['service']"        class="px-4 py-3 text-left  text-xs font-medium text-gray-500 uppercase tracking-wide">Service</th>
                <th *ngIf="cols['ipv4Address']"    class="px-4 py-3 text-left  text-xs font-medium text-gray-500 uppercase tracking-wide">IPv4</th>
                <th *ngIf="cols['ipv6Address']"    class="px-4 py-3 text-left  text-xs font-medium text-gray-500 uppercase tracking-wide">IPv6</th>
                <th *ngIf="cols['processorCount']" class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Processors</th>
                <th *ngIf="cols['coreCount']"      class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Cores</th>
                <th *ngIf="cols['systemMemoryBytes']"  class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Memory (GB)</th>
                <th *ngIf="cols['linuxDistribution']"  class="px-4 py-3 text-left  text-xs font-medium text-gray-500 uppercase tracking-wide">Linux Distro</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr *ngFor="let host of items" class="hover:bg-gray-50">
                <td class="px-4 py-3 font-medium text-gray-900">{{ host.hostname }}</td>
                <td *ngIf="cols['accountId']"       class="px-4 py-3 text-gray-600">{{ host.accountId || '—' }}</td>
                <td *ngIf="cols['location']"        class="px-4 py-3 text-gray-600">{{ host.location || '—' }}</td>
                <td *ngIf="cols['environment']"     class="px-4 py-3 text-gray-600">{{ host.environment || '—' }}</td>
                <td *ngIf="cols['team']"            class="px-4 py-3 text-gray-600">{{ host.team || '—' }}</td>
                <td *ngIf="cols['service']"         class="px-4 py-3 text-gray-600">{{ host.service || '—' }}</td>
                <td *ngIf="cols['ipv4Address']"     class="px-4 py-3 text-gray-600 font-mono text-xs">{{ host.ipv4Address || '—' }}</td>
                <td *ngIf="cols['ipv6Address']"     class="px-4 py-3 text-gray-600 font-mono text-xs">{{ host.ipv6Address || '—' }}</td>
                <td *ngIf="cols['processorCount']"  class="px-4 py-3 text-gray-600 text-right">{{ host.processorCount ?? '—' }}</td>
                <td *ngIf="cols['coreCount']"       class="px-4 py-3 text-gray-600 text-right">{{ host.coreCount ?? '—' }}</td>
                <td *ngIf="cols['systemMemoryBytes']"   class="px-4 py-3 text-gray-600 text-right">{{ formatMemory(host.systemMemoryBytes) }}</td>
                <td *ngIf="cols['linuxDistribution']"   class="px-4 py-3 text-gray-600">{{ host.linuxDistribution || '—' }}</td>
              </tr>
              <tr *ngIf="items.length === 0">
                <td [attr.colspan]="visibleColCount" class="px-4 py-8 text-center text-gray-400">No New Relic records found</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
          <span>{{ totalElements }} records</span>
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

  items: NewRelicRecord[] = [];
  environments: string[] = [];
  syncStatus?: SyncStatus;
  totalElements = 0;
  totalPages = 0;
  currentPage = 0;
  search = '';
  filterEnv = '';

  // Column visibility state — hostname is always visible and not tracked here
  cols: Record<string, boolean> = {
    accountId:         true,
    location:          false,
    environment:       false,
    team:              false,
    service:           false,
    ipv4Address:       true,
    ipv6Address:       false,
    processorCount:    true,
    coreCount:         true,
    systemMemoryBytes: true,
    linuxDistribution: true,
  };

  // Ordered metadata used to render the checkbox list
  colDefs: { key: string; label: string }[] = [
    { key: 'accountId',         label: 'Account ID'    },
    { key: 'location',          label: 'Location'      },
    { key: 'environment',       label: 'Environment'   },
    { key: 'team',              label: 'Team'          },
    { key: 'service',           label: 'Service'       },
    { key: 'ipv4Address',       label: 'IPv4'          },
    { key: 'ipv6Address',       label: 'IPv6'          },
    { key: 'processorCount',    label: 'Processors'    },
    { key: 'coreCount',         label: 'Cores'         },
    { key: 'systemMemoryBytes', label: 'Memory (GB)'   },
    { key: 'linuxDistribution', label: 'Linux Distro'  },
  ];

  showColPicker = false;

  /** Total visible column count: hostname (always 1) + enabled optional columns. */
  get visibleColCount(): number {
    return 1 + Object.values(this.cols).filter(Boolean).length;
  }

  toggleColPicker(event: MouseEvent): void {
    event.stopPropagation();
    this.showColPicker = !this.showColPicker;
  }

  /** Close the picker when the user clicks anywhere outside the panel. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.showColPicker) return;
    const root = document.getElementById('col-picker-root');
    if (root && !root.contains(event.target as Node)) {
      this.showColPicker = false;
    }
  }

  /** Close the picker on Escape key. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.showColPicker = false;
  }

  ngOnInit(): void {
    this.load();
    this.loadSyncStatus();
    this.newRelicService.getEnvironments().subscribe(envs => this.environments = envs);
  }

  onFilter(): void { this.currentPage = 0; this.load(); }

  load(): void {
    this.newRelicService.list({
      search: this.search,
      environment: this.filterEnv,
      page: this.currentPage,
      size: 20
    }).subscribe(res => {
      this.items = res.content;
      this.totalElements = res.totalElements;
      this.totalPages = res.totalPages;
    });
  }

  loadSyncStatus(): void {
    this.newRelicService.getSyncStatus().subscribe(s => this.syncStatus = s);
  }

  triggerSync(): void {
    this.newRelicService.triggerSync().subscribe(s => {
      this.syncStatus = s;
      setTimeout(() => this.loadSyncStatus(), 3000);
    });
  }

  prevPage(): void { this.currentPage--; this.load(); }
  nextPage(): void { this.currentPage++; this.load(); }

  formatMemory(bytes: number | undefined): string {
    if (bytes == null) return '—';
    return (bytes / 1073741824).toFixed(1);
  }

  syncStatusClass(status: string): string {
    return { running: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800', idle: 'bg-gray-100 text-gray-600' }[status] ?? '';
  }
}
