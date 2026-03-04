import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../core/services/inventory.service';
import { Inventory } from '../../core/models/inventory.model';
import { PagedResponse } from '../../core/models/paged-response.model';

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
          <p class="text-sm text-gray-500">Total Assets</p>
          <p class="text-3xl font-bold text-gray-800">{{ totalElements }}</p>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <p class="text-sm text-gray-500">Active</p>
          <p class="text-3xl font-bold text-green-600">{{ countByStatus('active') }}</p>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <p class="text-sm text-gray-500">Maintenance</p>
          <p class="text-3xl font-bold text-yellow-600">{{ countByStatus('maintenance') }}</p>
        </div>
      </div>

      <!-- Filters + Search -->
      <div class="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-3">
        <input
          [(ngModel)]="search"
          (ngModelChange)="onFilter()"
          placeholder="Search hostname..."
          class="border border-gray-300 rounded px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select [(ngModel)]="filterEnv" (ngModelChange)="onFilter()"
                class="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
          <option value="">All Environments</option>
          <option value="production">Production</option>
          <option value="staging">Staging</option>
          <option value="dev">Dev</option>
          <option value="dr">DR</option>
        </select>
        <select [(ngModel)]="filterStatus" (ngModelChange)="onFilter()"
                class="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
          <option value="decommissioned">Decommissioned</option>
          <option value="unknown">Unknown</option>
        </select>
        <select [(ngModel)]="filterType" (ngModelChange)="onFilter()"
                class="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
          <option value="">All Types</option>
          <option value="server">Server</option>
          <option value="vm">VM</option>
          <option value="container">Container</option>
          <option value="network">Network</option>
        </select>
      </div>

      <!-- Inventory table -->
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hostname</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Environment</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr *ngFor="let item of items" class="hover:bg-gray-50">
              <td class="px-4 py-3">
                <a [routerLink]="['/inventory', item.hostname]"
                   class="text-blue-600 hover:underline font-medium">{{ item.hostname }}</a>
              </td>
              <td class="px-4 py-3 text-gray-600">{{ item.ipAddress }}</td>
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">{{ item.assetType }}</span>
              </td>
              <td class="px-4 py-3 text-gray-600">{{ item.environment }}</td>
              <td class="px-4 py-3">
                <span [class]="statusClass(item.status)"
                      class="px-2 py-0.5 rounded text-xs font-medium">{{ item.status }}</span>
              </td>
              <td class="px-4 py-3 text-gray-600">{{ item.owner || '—' }}</td>
            </tr>
            <tr *ngIf="items.length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-gray-400">No records found</td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div class="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
          <span>{{ totalElements }} total records</span>
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

  items: Inventory[] = [];
  totalElements = 0;
  totalPages = 0;
  currentPage = 0;
  search = '';
  filterEnv = '';
  filterStatus = '';
  filterType = '';

  ngOnInit(): void {
    this.load();
  }

  onFilter(): void {
    this.currentPage = 0;
    this.load();
  }

  load(): void {
    this.inventoryService.list({
      search: this.search,
      environment: this.filterEnv,
      status: this.filterStatus,
      assetType: this.filterType,
      page: this.currentPage,
      size: 20
    }).subscribe((res: PagedResponse<Inventory>) => {
      this.items = res.content;
      this.totalElements = res.totalElements;
      this.totalPages = res.totalPages;
    });
  }

  prevPage(): void { this.currentPage--; this.load(); }
  nextPage(): void { this.currentPage++; this.load(); }

  countByStatus(status: string): number {
    return this.items.filter(i => i.status === status).length;
  }

  statusClass(status: string): string {
    return {
      active: 'bg-green-100 text-green-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
      decommissioned: 'bg-gray-100 text-gray-500',
      unknown: 'bg-red-100 text-red-700'
    }[status] ?? 'bg-gray-100 text-gray-600';
  }

}
