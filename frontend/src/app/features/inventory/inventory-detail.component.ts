import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { InventoryService } from '../../core/services/inventory.service';
import { AssetDetail } from '../../core/models/inventory.model';

@Component({
  selector: 'app-inventory-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="p-6 max-w-5xl">
      <a routerLink="/dashboard" class="text-blue-600 hover:underline text-sm">&larr; Back to Dashboard</a>

      <div *ngIf="detail" class="mt-4">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-gray-800">{{ detail.inventory.hostname }}</h1>
          <div class="flex gap-2">
            <span [class]="statusClass(detail.inventory.status)"
                  class="px-3 py-1 rounded-full text-sm font-medium">{{ detail.inventory.status }}</span>
          </div>
        </div>

        <!-- Tabs -->
        <div class="border-b border-gray-200 mb-6">
          <nav class="flex gap-6">
            <button (click)="activeTab='inventory'" [class.border-blue-600]="activeTab==='inventory'"
                    [class.text-blue-600]="activeTab==='inventory'"
                    class="pb-2 text-sm font-medium border-b-2 border-transparent text-gray-500">Inventory</button>
            <button (click)="activeTab='vsphere'" [class.border-blue-600]="activeTab==='vsphere'"
                    [class.text-blue-600]="activeTab==='vsphere'"
                    class="pb-2 text-sm font-medium border-b-2 border-transparent text-gray-500">
              vSphere {{ detail.vsphere ? '' : '(no data)' }}
            </button>
            <button (click)="activeTab='newrelic'" [class.border-blue-600]="activeTab==='newrelic'"
                    [class.text-blue-600]="activeTab==='newrelic'"
                    class="pb-2 text-sm font-medium border-b-2 border-transparent text-gray-500">
              New Relic {{ detail.newRelic ? '' : '(no data)' }}
            </button>
          </nav>
        </div>

        <!-- Inventory tab -->
        <div *ngIf="activeTab==='inventory'" class="bg-white rounded-lg shadow p-6">
          <dl class="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div><dt class="text-gray-500">IP Address</dt><dd class="font-medium">{{ detail.inventory.ipAddress }}</dd></div>
            <div><dt class="text-gray-500">Asset Type</dt><dd class="font-medium">{{ detail.inventory.assetType }}</dd></div>
            <div><dt class="text-gray-500">Environment</dt><dd class="font-medium">{{ detail.inventory.environment }}</dd></div>
            <div><dt class="text-gray-500">Owner</dt><dd class="font-medium">{{ detail.inventory.owner || '—' }}</dd></div>
            <div><dt class="text-gray-500">Location</dt><dd class="font-medium">{{ detail.inventory.location || '—' }}</dd></div>
            <div><dt class="text-gray-500">Warranty Expiry</dt><dd class="font-medium">{{ detail.inventory.warrantyExpiry || '—' }}</dd></div>
            <div><dt class="text-gray-500">Last Patched</dt><dd class="font-medium">{{ detail.inventory.lastPatchedAt || '—' }}</dd></div>
            <div><dt class="text-gray-500">Created</dt><dd class="font-medium">{{ detail.inventory.createdAt | date:'medium' }}</dd></div>
          </dl>
        </div>

        <!-- vSphere tab -->
        <div *ngIf="activeTab==='vsphere'" class="bg-white rounded-lg shadow p-6">
          <div *ngIf="detail.vsphere; else noData">
            <dl class="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div><dt class="text-gray-500">VM Name</dt><dd class="font-medium">{{ detail.vsphere.vmName }}</dd></div>
              <div><dt class="text-gray-500">VM ID</dt><dd class="font-medium font-mono text-xs">{{ detail.vsphere.vmId }}</dd></div>
              <div><dt class="text-gray-500">Power State</dt><dd class="font-medium">{{ detail.vsphere.powerState || '—' }}</dd></div>
              <div><dt class="text-gray-500">Guest OS</dt><dd class="font-medium">{{ detail.vsphere.guestOs || '—' }}</dd></div>
              <div><dt class="text-gray-500">CPU</dt><dd class="font-medium">{{ detail.vsphere.cpuCount ?? '—' }} vCPU</dd></div>
              <div><dt class="text-gray-500">Memory</dt><dd class="font-medium">{{ detail.vsphere.memoryGb ?? '—' }} GB</dd></div>
              <div><dt class="text-gray-500">Disk</dt><dd class="font-medium">{{ detail.vsphere.diskGb ?? '—' }} GB</dd></div>
              <div><dt class="text-gray-500">IPv4</dt><dd class="font-medium">{{ detail.vsphere.ipv4Address || '—' }}</dd></div>
              <div><dt class="text-gray-500">Last Synced</dt><dd class="font-medium">{{ detail.vsphere.lastSyncedAt | date:'medium' }}</dd></div>
              <div><dt class="text-gray-500">Tools Status</dt><dd class="font-medium">{{ detail.vsphere.toolsStatus || '—' }}</dd></div>
            </dl>
          </div>
          <ng-template #noData>
            <p class="text-gray-400 text-sm">No vSphere data for this host.</p>
          </ng-template>
        </div>

        <!-- New Relic tab -->
        <div *ngIf="activeTab==='newrelic'" class="bg-white rounded-lg shadow p-6">
          <div *ngIf="detail.newRelic; else noNrData">
            <dl class="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div><dt class="text-gray-500">FQDN</dt><dd class="font-medium">{{ detail.newRelic.fqdn || '—' }}</dd></div>
              <div><dt class="text-gray-500">Guest OS</dt><dd class="font-medium">{{ detail.newRelic.guestOs || '—' }}</dd></div>
              <div><dt class="text-gray-500">Application</dt><dd class="font-medium">{{ detail.newRelic.application || '—' }}</dd></div>
              <div><dt class="text-gray-500">Environment</dt><dd class="font-medium">{{ detail.newRelic.environment || '—' }}</dd></div>
              <div><dt class="text-gray-500">CPU</dt><dd class="font-medium">{{ detail.newRelic.cpuCount ?? '—' }}</dd></div>
              <div><dt class="text-gray-500">Memory</dt><dd class="font-medium">{{ detail.newRelic.memoryGb ?? '—' }} GB</dd></div>
              <div><dt class="text-gray-500">IPv4</dt><dd class="font-medium">{{ detail.newRelic.ipv4Address || '—' }}</dd></div>
              <div><dt class="text-gray-500">Last Reported</dt><dd class="font-medium">{{ detail.newRelic.lastReportedAt | date:'medium' }}</dd></div>
              <div *ngIf="detail.newRelic.tags" class="col-span-2">
                <dt class="text-gray-500 mb-1">Tags</dt>
                <dd class="font-mono text-xs bg-gray-50 p-2 rounded">{{ detail.newRelic.tags }}</dd>
              </div>
            </dl>
          </div>
          <ng-template #noNrData>
            <p class="text-gray-400 text-sm">No New Relic data for this host.</p>
          </ng-template>
        </div>
      </div>

      <div *ngIf="!detail" class="mt-8 text-center text-gray-400">Loading...</div>
    </div>
  `
})
export class InventoryDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private inventoryService = inject(InventoryService);

  detail?: AssetDetail;
  activeTab: 'inventory' | 'vsphere' | 'newrelic' = 'inventory';

  ngOnInit(): void {
    const hostname = this.route.snapshot.paramMap.get('hostname')!;
    this.inventoryService.getDetail(hostname).subscribe(d => this.detail = d);
  }

  statusClass(s: string): string {
    return { active: 'bg-green-100 text-green-800', maintenance: 'bg-yellow-100 text-yellow-800',
      decommissioned: 'bg-gray-100 text-gray-500', unknown: 'bg-red-100 text-red-700' }[s] ?? '';
  }

}
