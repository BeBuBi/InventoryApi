import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CredentialService } from '../../../core/services/credential.service';
import { Credential, CredentialRequest } from '../../../core/models/credential.model';

@Component({
  selector: 'app-credentials',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 max-w-4xl">
      <h1 class="text-2xl font-bold text-gray-800 mb-6">Credentials</h1>

      <!-- Tab selector -->
      <div class="flex gap-4 mb-6">
        <button (click)="selectService('vsphere')" [class.bg-blue-600]="activeService==='vsphere'"
                [class.text-white]="activeService==='vsphere'"
                class="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50">
          vSphere
        </button>
        <button (click)="selectService('newrelic')" [class.bg-blue-600]="activeService==='newrelic'"
                [class.text-white]="activeService==='newrelic'"
                class="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50">
          New Relic
        </button>
      </div>

      <!-- Add new form -->
      <div class="bg-white rounded-lg shadow p-4 mb-6">
        <h2 class="text-sm font-semibold text-gray-700 mb-3">Add Credential</h2>
        <div class="flex flex-wrap gap-3">
          <input [(ngModel)]="newName" placeholder="Name (e.g. Production vCenter)"
                 class="border border-gray-300 rounded px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <textarea [(ngModel)]="newConfig" placeholder='JSON config (e.g. {"host":"...","username":"...","password":"..."})'
                    class="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-64 h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
          <button (click)="addCredential()"
                  class="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700">
            Add
          </button>
        </div>
        <p *ngIf="errorMsg" class="text-red-600 text-xs mt-2">{{ errorMsg }}</p>
      </div>

      <!-- Credentials list -->
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr *ngFor="let cred of credentials" class="hover:bg-gray-50">
              <td class="px-4 py-3 font-medium">{{ cred.name }}</td>
              <td class="px-4 py-3">
                <span [class]="cred.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'"
                      class="px-2 py-0.5 rounded text-xs font-medium">
                  {{ cred.enabled ? 'Enabled' : 'Disabled' }}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-500 text-xs">{{ cred.createdAt | date:'short' }}</td>
              <td class="px-4 py-3 flex gap-2">
                <button *ngIf="cred.enabled" (click)="disable(cred)"
                        class="text-xs text-yellow-600 hover:underline">Disable</button>
                <button *ngIf="!cred.enabled" (click)="enable(cred)"
                        class="text-xs text-green-600 hover:underline">Enable</button>
                <button (click)="delete(cred)"
                        class="text-xs text-red-600 hover:underline">Delete</button>
              </td>
            </tr>
            <tr *ngIf="credentials.length === 0">
              <td colspan="4" class="px-4 py-8 text-center text-gray-400">No credentials configured</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class CredentialsComponent implements OnInit {
  private credentialService = inject(CredentialService);

  credentials: Credential[] = [];
  activeService: 'vsphere' | 'newrelic' = 'vsphere';
  newName = '';
  newConfig = '';
  errorMsg = '';

  ngOnInit(): void {
    this.loadCredentials();
  }

  selectService(service: 'vsphere' | 'newrelic'): void {
    this.activeService = service;
    this.loadCredentials();
  }

  loadCredentials(): void {
    this.credentialService.listByService(this.activeService)
      .subscribe(list => this.credentials = list);
  }

  addCredential(): void {
    this.errorMsg = '';
    if (!this.newName.trim() || !this.newConfig.trim()) {
      this.errorMsg = 'Name and config are required.';
      return;
    }
    const req: CredentialRequest = {
      service: this.activeService,
      name: this.newName.trim(),
      config: this.newConfig.trim()
    };
    this.credentialService.create(req).subscribe({
      next: () => { this.newName = ''; this.newConfig = ''; this.loadCredentials(); },
      error: (e) => { this.errorMsg = e?.error?.message ?? 'Failed to save credential.'; }
    });
  }

  enable(cred: Credential): void {
    this.credentialService.enable(cred.id).subscribe(() => this.loadCredentials());
  }

  disable(cred: Credential): void {
    this.credentialService.disable(cred.id).subscribe(() => this.loadCredentials());
  }

  delete(cred: Credential): void {
    if (!confirm(`Delete credential "${cred.name}"?`)) return;
    this.credentialService.delete(cred.id).subscribe(() => this.loadCredentials());
  }
}
