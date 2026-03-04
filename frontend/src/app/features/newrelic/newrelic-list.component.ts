import { Component, OnInit, inject } from '@angular/core';
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

      <!-- Filters -->
      <div class="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-3">
        <input [(ngModel)]="search" (ngModelChange)="onFilter()" placeholder="Search hostname..."
               class="border border-gray-300 rounded px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input [(ngModel)]="filterApp" (ngModelChange)="onFilter()" placeholder="Application..."
               class="border border-gray-300 rounded px-3 py-2 text-sm w-40 focus:outline-none" />
        <select [(ngModel)]="filterEnv" (ngModelChange)="onFilter()"
                class="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
          <option value="">All Environments</option>
          <option value="production">Production</option>
          <option value="staging">Staging</option>
          <option value="dev">Dev</option>
        </select>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hostname</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Application</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Environment</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest OS</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPU</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Memory (GB)</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IPv4</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Reported</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr *ngFor="let host of items" class="hover:bg-gray-50">
              <td class="px-4 py-3 font-medium">{{ host.hostname }}</td>
              <td class="px-4 py-3 text-gray-600">{{ host.application || '—' }}</td>
              <td class="px-4 py-3 text-gray-600">{{ host.environment || '—' }}</td>
              <td class="px-4 py-3 text-gray-600">{{ host.guestOs || '—' }}</td>
              <td class="px-4 py-3 text-gray-600">{{ host.cpuCount ?? '—' }}</td>
              <td class="px-4 py-3 text-gray-600">{{ host.memoryGb ?? '—' }}</td>
              <td class="px-4 py-3 text-gray-600">{{ host.ipv4Address || '—' }}</td>
              <td class="px-4 py-3 text-gray-500 text-xs">{{ host.lastReportedAt | date:'short' }}</td>
            </tr>
            <tr *ngIf="items.length === 0">
              <td colspan="8" class="px-4 py-8 text-center text-gray-400">No New Relic records found</td>
            </tr>
          </tbody>
        </table>

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
  syncStatus?: SyncStatus;
  totalElements = 0;
  totalPages = 0;
  currentPage = 0;
  search = '';
  filterApp = '';
  filterEnv = '';

  ngOnInit(): void {
    this.load();
    this.loadSyncStatus();
  }

  onFilter(): void { this.currentPage = 0; this.load(); }

  load(): void {
    this.newRelicService.list({
      search: this.search, application: this.filterApp,
      environment: this.filterEnv, page: this.currentPage, size: 20
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

  syncStatusClass(status: string): string {
    return { running: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800', idle: 'bg-gray-100 text-gray-600' }[status] ?? '';
  }
}
