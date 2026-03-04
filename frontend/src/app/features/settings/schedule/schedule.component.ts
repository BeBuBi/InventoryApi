import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScheduleService } from '../../../core/services/schedule.service';
import { SyncSchedule, SyncScheduleRequest } from '../../../core/models/sync-schedule.model';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 max-w-3xl">
      <h1 class="text-2xl font-bold text-gray-800 mb-6">Sync Schedule</h1>

      <div class="space-y-6">
        <div *ngFor="let schedule of schedules" class="bg-white rounded-lg shadow p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-700 capitalize">
              {{ schedule.service === 'vsphere' ? 'vSphere' : 'New Relic' }}
            </h2>
            <div class="flex items-center gap-3">
              <span [class]="schedule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'"
                    class="px-2 py-0.5 rounded text-xs font-medium">
                {{ schedule.enabled ? 'Enabled' : 'Disabled' }}
              </span>
              <button *ngIf="schedule.enabled" (click)="disable(schedule)"
                      class="text-xs text-yellow-600 hover:underline">Disable</button>
              <button *ngIf="!schedule.enabled" (click)="enable(schedule)"
                      class="text-xs text-green-600 hover:underline">Enable</button>
            </div>
          </div>

          <div *ngIf="editingService !== schedule.service" class="space-y-2 text-sm">
            <div class="flex gap-6">
              <div>
                <span class="text-gray-500">Cron Expression:</span>
                <span class="ml-2 font-mono font-medium">{{ schedule.cronExpr }}</span>
              </div>
              <div>
                <span class="text-gray-500">Description:</span>
                <span class="ml-2">{{ schedule.description || '—' }}</span>
              </div>
            </div>
            <div *ngIf="schedule.lastRunAt" class="text-gray-500">
              Last run: {{ schedule.lastRunAt | date:'medium' }}
            </div>
            <button (click)="startEdit(schedule)"
                    class="mt-2 text-sm text-blue-600 hover:underline">Edit</button>
          </div>

          <!-- Edit form -->
          <div *ngIf="editingService === schedule.service" class="space-y-3 text-sm">
            <div>
              <label class="block text-gray-600 mb-1">Cron Expression (6-field)</label>
              <input [(ngModel)]="editCronExpr" placeholder="0 0 2 * * *"
                     class="border border-gray-300 rounded px-3 py-2 text-sm w-56 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label class="block text-gray-600 mb-1">Description</label>
              <input [(ngModel)]="editDescription" placeholder="Every day at 2:00 AM"
                     class="border border-gray-300 rounded px-3 py-2 text-sm w-72 focus:outline-none" />
            </div>
            <p class="text-xs text-gray-500">
              Examples: <code>0 0 2 * * *</code> (daily 2AM) &nbsp;|&nbsp;
              <code>0 0 6 * * MON-FRI</code> (weekdays 6AM)
            </p>
            <div class="flex gap-3 pt-1">
              <button (click)="saveEdit(schedule)"
                      class="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Save</button>
              <button (click)="editingService = null"
                      class="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
            </div>
            <p *ngIf="errorMsg" class="text-red-600 text-xs">{{ errorMsg }}</p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ScheduleComponent implements OnInit {
  private scheduleService = inject(ScheduleService);

  schedules: SyncSchedule[] = [];
  editingService: string | null = null;
  editCronExpr = '';
  editDescription = '';
  errorMsg = '';

  ngOnInit(): void {
    this.loadSchedules();
  }

  loadSchedules(): void {
    this.scheduleService.listAll().subscribe(list => this.schedules = list);
  }

  enable(s: SyncSchedule): void {
    this.scheduleService.enable(s.service).subscribe(() => this.loadSchedules());
  }

  disable(s: SyncSchedule): void {
    this.scheduleService.disable(s.service).subscribe(() => this.loadSchedules());
  }

  startEdit(s: SyncSchedule): void {
    this.editingService = s.service;
    this.editCronExpr = s.cronExpr;
    this.editDescription = s.description ?? '';
    this.errorMsg = '';
  }

  saveEdit(s: SyncSchedule): void {
    this.errorMsg = '';
    if (!this.editCronExpr.trim()) {
      this.errorMsg = 'Cron expression is required.';
      return;
    }
    const req: SyncScheduleRequest = {
      service: s.service,
      cronExpr: this.editCronExpr.trim(),
      enabled: s.enabled,
      description: this.editDescription.trim() || undefined
    };
    this.scheduleService.update(s.service, req).subscribe({
      next: () => { this.editingService = null; this.loadSchedules(); },
      error: (e) => { this.errorMsg = e?.error?.message ?? 'Failed to update schedule.'; }
    });
  }
}
