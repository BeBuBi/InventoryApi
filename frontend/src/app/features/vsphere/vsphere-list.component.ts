import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VsphereService } from '../../core/services/vsphere.service';
import { VsphereRecord } from '../../core/models/vsphere.model';
import { SyncStatus } from '../../core/models/sync-schedule.model';

@Component({
  selector: 'app-vsphere-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-800">vSphere VMs</h1>
        <div class="flex items-center gap-3">
          <span *ngIf="syncStatus" [class]="syncStatusClass(syncStatus.status)"
                class="text-xs font-medium px-2 py-1 rounded">
            {{ syncStatus.status }}
          </span>
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
        <input [(ngModel)]="filterCluster" (ngModelChange)="onFilter()" placeholder="Cluster..."
               class="border border-gray-300 rounded px-3 py-2 text-sm w-36 focus:outline-none" />
        <select [(ngModel)]="filterPowerState" (ngModelChange)="onFilter()"
                class="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
          <option value="">All Power States</option>
          <option value="poweredOn">Powered On</option>
          <option value="poweredOff">Powered Off</option>
          <option value="suspended">Suspended</option>
        </select>
        <span class="ml-auto self-center text-sm text-gray-500">{{ totalElements }} records</span>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hostname</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">VM Name</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Power State</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPU</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Memory (GB)</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cluster</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest OS</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Synced</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr *ngFor="let vm of items" class="hover:bg-gray-50">
              <td class="px-4 py-3 font-medium">{{ vm.hostname }}</td>
              <td class="px-4 py-3 text-gray-600">{{ vm.vmName }}</td>
              <td class="px-4 py-3">
                <span [class]="powerStateClass(vm.powerState)"
                      class="px-2 py-0.5 rounded text-xs font-medium">{{ vm.powerState || '—' }}</span>
              </td>
              <td class="px-4 py-3 text-gray-600">{{ vm.cpuCount ?? '—' }}</td>
              <td class="px-4 py-3 text-gray-600">{{ vm.memoryGb ?? '—' }}</td>
              <td class="px-4 py-3 text-gray-600">{{ vm.cluster || '—' }}</td>
              <td class="px-4 py-3 text-gray-600">{{ vm.guestOs || '—' }}</td>
              <td class="px-4 py-3 text-gray-500 text-xs">{{ vm.lastSyncedAt | date:'short' }}</td>
            </tr>
            <tr *ngIf="items.length === 0">
              <td colspan="8" class="px-4 py-8 text-center text-gray-400">No vSphere records found</td>
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

  items: VsphereRecord[] = [];
  syncStatus?: SyncStatus;
  totalElements = 0;
  totalPages = 0;
  currentPage = 0;
  pageSize = 20;
  search = '';
  filterCluster = '';
  filterPowerState = '';

  ngOnInit(): void {
    this.load();
    this.loadSyncStatus();
  }

  onFilter(): void { this.currentPage = 0; this.load(); }

  onPageSizeChange(): void { this.currentPage = 0; this.load(); }

  load(): void {
    this.vsphereService.list({
      search: this.search, cluster: this.filterCluster,
      powerState: this.filterPowerState, page: this.currentPage, size: this.pageSize
    }).subscribe(res => {
      this.items = res.content;
      this.totalElements = res.totalElements;
      this.totalPages = res.totalPages;
    });
  }

  loadSyncStatus(): void {
    this.vsphereService.getSyncStatus().subscribe(s => this.syncStatus = s);
  }

  triggerSync(): void {
    this.vsphereService.triggerSync().subscribe(s => {
      this.syncStatus = s;
      setTimeout(() => this.loadSyncStatus(), 3000);
    });
  }

  prevPage(): void { this.currentPage--; this.load(); }
  nextPage(): void { this.currentPage++; this.load(); }

  powerStateClass(state?: string): string {
    return { poweredOn: 'bg-green-100 text-green-800', poweredOff: 'bg-gray-100 text-gray-600',
      suspended: 'bg-yellow-100 text-yellow-800' }[state ?? ''] ?? 'bg-gray-100 text-gray-500';
  }

  syncStatusClass(status: string): string {
    return { running: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800', idle: 'bg-gray-100 text-gray-600' }[status] ?? '';
  }
}
