import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { InventoryService } from '../../core/services/inventory.service';
import { Inventory } from '../../core/models/inventory.model';

@Component({
  selector: 'app-inventory-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="p-6 max-w-5xl">
      <a routerLink="/dashboard" class="text-blue-600 hover:underline text-sm">&larr; Back to Dashboard</a>

      <div *ngIf="loading" class="mt-8 text-center text-gray-400">Loading...</div>

      <div *ngIf="!loading && item" class="mt-4">
        <!-- Header -->
        <div class="flex items-center gap-3 mb-6">
          <h1 class="text-2xl font-bold text-gray-800">{{ item.hostname }}</h1>
          <span *ngFor="let src of parseSources(item.sources)"
                [class]="sourceBadgeClass(src)"
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium">
            {{ sourceLabel(src) }}
          </span>
        </div>

        <!-- Common section -->
        <div class="bg-white rounded-lg shadow p-6 mb-4">
          <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Common</h2>
          <dl class="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div>
              <dt class="text-gray-500">IP Address (CMDB)</dt>
              <dd class="font-medium font-mono text-xs">{{ item.cmdbIpAddress || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">IP Address (New Relic)</dt>
              <dd class="font-medium font-mono text-xs">{{ item.nrIpv4 || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">IP Address (vSphere)</dt>
              <dd class="font-medium font-mono text-xs">{{ item.vsphereIpv4 || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Environment (CMDB)</dt>
              <dd class="font-medium">{{ item.cmdbEnvironment || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Environment (New Relic)</dt>
              <dd class="font-medium">{{ item.nrEnvironment || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Location (CMDB)</dt>
              <dd class="font-medium">{{ item.cmdbLocation || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Location (New Relic)</dt>
              <dd class="font-medium">{{ item.nrLocation || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">OS</dt>
              <dd class="font-medium">{{ item.os || item.guestOs || '—' }}</dd>
            </div>
          </dl>
        </div>

        <!-- vSphere section -->
        <div *ngIf="item.vmName" class="bg-white rounded-lg shadow p-6 mb-4">
          <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            vSphere
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">VS</span>
          </h2>
          <dl class="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div>
              <dt class="text-gray-500">VM Name</dt>
              <dd class="font-medium">{{ item.vmName }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Power State</dt>
              <dd>
                <span *ngIf="item.powerState"
                      [class]="powerStateClass(item.powerState)"
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                  {{ item.powerState }}
                </span>
                <span *ngIf="!item.powerState" class="font-medium">—</span>
              </dd>
            </div>
            <div>
              <dt class="text-gray-500">Guest OS</dt>
              <dd class="font-medium">{{ item.guestOs || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">CPU (sockets)</dt>
              <dd class="font-medium">{{ item.cpuCount != null ? item.cpuCount : '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">CPU (cores)</dt>
              <dd class="font-medium">{{ item.cpuCores != null ? item.cpuCores : '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Memory</dt>
              <dd class="font-medium">{{ item.memoryGb != null ? item.memoryGb + ' GB' : '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Tools Status</dt>
              <dd class="font-medium">{{ item.toolsStatus || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">IPv6</dt>
              <dd class="font-medium font-mono text-xs">{{ item.vsphereIpv6 || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Last Synced</dt>
              <dd class="font-medium">{{ item.vsphereLastSynced || '—' }}</dd>
            </div>
          </dl>
        </div>

        <!-- New Relic section -->
        <div *ngIf="item.fullHostname || item.nrIpv4" class="bg-white rounded-lg shadow p-6 mb-4">
          <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            New Relic
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">NR</span>
          </h2>
          <dl class="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div>
              <dt class="text-gray-500">Full Hostname</dt>
              <dd class="font-medium">{{ item.fullHostname || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">IPv4</dt>
              <dd class="font-medium font-mono text-xs">{{ item.nrIpv4 || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">IPv6</dt>
              <dd class="font-medium font-mono text-xs">{{ item.nrIpv6 || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">CPU (processors)</dt>
              <dd class="font-medium">{{ item.processorCount != null ? item.processorCount : '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">CPU (cores)</dt>
              <dd class="font-medium">{{ item.coreCount != null ? item.coreCount : '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Memory</dt>
              <dd class="font-medium">
                {{ item.systemMemoryBytes != null ? (item.systemMemoryBytes / 1073741824 | number:'1.0-0') + ' GB' : '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-gray-500">Linux Distro</dt>
              <dd class="font-medium">{{ item.linuxDistribution || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Service</dt>
              <dd class="font-medium">{{ item.service || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Team</dt>
              <dd class="font-medium">{{ item.team || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Account ID</dt>
              <dd class="font-medium">{{ item.accountId || '—' }}</dd>
            </div>
          </dl>
        </div>

        <!-- CMDB section -->
        <div *ngIf="item.sysId || item.operationalStatus" class="bg-white rounded-lg shadow p-6 mb-4">
          <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            CMDB
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">CMDB</span>
          </h2>
          <dl class="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div>
              <dt class="text-gray-500">Sys ID</dt>
              <dd class="font-medium font-mono text-xs">{{ item.sysId || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">OS Version</dt>
              <dd class="font-medium">{{ item.osVersion || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Department</dt>
              <dd class="font-medium">{{ item.department || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Operational Status</dt>
              <dd>
                <span *ngIf="item.operationalStatus"
                      [class]="opStatusClass(item.operationalStatus)"
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                  {{ opStatusLabel(item.operationalStatus) }}
                </span>
                <span *ngIf="!item.operationalStatus" class="font-medium">—</span>
              </dd>
            </div>
            <div>
              <dt class="text-gray-500">Classification</dt>
              <dd class="font-medium">{{ item.classification || '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Last Synced</dt>
              <dd class="font-medium">{{ item.cmdbLastSynced || '—' }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div *ngIf="!loading && !item" class="mt-8 text-center text-gray-400">Host not found.</div>
    </div>
  `
})
export class InventoryDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private inventoryService = inject(InventoryService);

  item?: Inventory;
  loading = true;

  ngOnInit(): void {
    const hostname = this.route.snapshot.paramMap.get('hostname')!;
    this.inventoryService.getByHostname(hostname).subscribe({
      next: (inv) => { this.item = inv; this.loading = false; },
      error: () => { this.loading = false; }
    });
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

  powerStateClass(state: string): string {
    const s = state.toLowerCase();
    if (s === 'poweredon') return 'bg-green-100 text-green-800';
    if (s === 'poweredoff') return 'bg-gray-100 text-gray-600';
    if (s === 'suspended') return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-600';
  }

  opStatusLabel(status?: string): string {
    switch (status) {
      case '1': return 'Operational';
      case '2': return 'Repair in Progress';
      case '3': return 'Do Not Use';
      case '6': return 'Retired';
      case '7': return 'Stolen';
      default:  return status ?? '—';
    }
  }

  opStatusClass(status?: string): string {
    switch (status) {
      case '1': return 'bg-green-100 text-green-800';
      case '2': return 'bg-yellow-100 text-yellow-800';
      case '3': return 'bg-red-100 text-red-800';
      case '6': return 'bg-gray-100 text-gray-600';
      case '7': return 'bg-red-100 text-red-800';
      default:  return 'bg-gray-100 text-gray-500';
    }
  }
}
