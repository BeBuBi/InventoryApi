import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { interval } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ScheduleService } from '../../../core/services/schedule.service';
import { VsphereService } from '../../../core/services/vsphere.service';
import { NewRelicService } from '../../../core/services/newrelic.service';
import { SyncSchedule, SyncScheduleRequest, SyncStatus } from '../../../core/models/sync-schedule.model';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 max-w-3xl">
      <h1 class="text-2xl font-bold text-gray-800 mb-6">Sync Schedule</h1>

      <div class="space-y-6">
        <div *ngFor="let schedule of schedules" class="bg-white rounded-lg shadow p-6">

          <!-- Card header: service name + enabled badge + enable/disable toggle -->
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-700">
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

          <!-- Sync Now row -->
          <div class="flex items-start gap-4 mb-4 pb-4 border-b border-gray-100">
            <button
              (click)="triggerSync(schedule.service)"
              [disabled]="getSyncStatus(schedule.service)?.status === 'running'"
              class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
              [attr.aria-label]="'Trigger manual sync for ' + (schedule.service === 'vsphere' ? 'vSphere' : 'New Relic')"
            >
              <!-- Spinner icon while running -->
              <svg *ngIf="getSyncStatus(schedule.service)?.status === 'running'"
                   class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              <!-- Refresh icon at rest -->
              <svg *ngIf="getSyncStatus(schedule.service)?.status !== 'running'"
                   class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M4 4v5h.582M20 20v-5h-.581M5.635 15A9 9 0 1018.364 8.636" />
              </svg>
              {{ getSyncStatus(schedule.service)?.status === 'running' ? 'Syncing...' : 'Sync Now' }}
            </button>

            <!-- Status badge + last run timestamp + last error -->
            <div class="flex flex-col gap-1 pt-1.5">
              <span
                *ngIf="getSyncStatus(schedule.service) as status"
                [ngClass]="syncStatusClasses(status.status)"
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                role="status"
                [attr.aria-label]="'Sync status: ' + status.status"
              >
                {{ status.status | titlecase }}
              </span>
              <span *ngIf="getSyncStatus(schedule.service)?.lastRunAt as lastRun"
                    class="text-xs text-gray-400">
                Last synced: {{ lastRun | date:'medium' }}
              </span>
              <span *ngIf="getSyncStatus(schedule.service)?.lastError as err"
                    class="text-xs text-red-600 max-w-sm break-words"
                    role="alert">
                {{ err }}
              </span>
            </div>
          </div>

          <!-- Schedule info (read mode) -->
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
              Last scheduled run: {{ schedule.lastRunAt | date:'medium' }}
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
  private vsphereService  = inject(VsphereService);
  private newRelicService = inject(NewRelicService);
  private destroyRef      = inject(DestroyRef);

  schedules: SyncSchedule[] = [];
  editingService: string | null = null;
  editCronExpr = '';
  editDescription = '';
  errorMsg = '';

  // Latest known SyncStatus per service, keyed by service name.
  private syncStatuses: Record<string, SyncStatus> = {};

  // Prevents duplicate poll loops for a service already being polled.
  private polling: Record<string, boolean> = {};

  ngOnInit(): void {
    this.loadSchedules();
    this.loadSyncStatuses();
  }

  // ── Schedule CRUD ──────────────────────────────────────────────────────────

  loadSchedules(): void {
    this.scheduleService.listAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(list => this.schedules = list);
  }

  enable(s: SyncSchedule): void {
    this.scheduleService.enable(s.service)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadSchedules());
  }

  disable(s: SyncSchedule): void {
    this.scheduleService.disable(s.service)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadSchedules());
  }

  startEdit(s: SyncSchedule): void {
    this.editingService  = s.service;
    this.editCronExpr    = s.cronExpr;
    this.editDescription = s.description ?? '';
    this.errorMsg        = '';
  }

  saveEdit(s: SyncSchedule): void {
    this.errorMsg = '';
    if (!this.editCronExpr.trim()) {
      this.errorMsg = 'Cron expression is required.';
      return;
    }
    const req: SyncScheduleRequest = {
      service:     s.service,
      cronExpr:    this.editCronExpr.trim(),
      enabled:     s.enabled,
      description: this.editDescription.trim() || undefined
    };
    this.scheduleService.update(s.service, req)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  () => { this.editingService = null; this.loadSchedules(); },
        error: (e) => { this.errorMsg = e?.error?.message ?? 'Failed to update schedule.'; }
      });
  }

  // ── Sync status ────────────────────────────────────────────────────────────

  getSyncStatus(service: string): SyncStatus | undefined {
    return this.syncStatuses[service];
  }

  syncStatusClasses(status: SyncStatus['status']): string {
    switch (status) {
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'success': return 'bg-green-100 text-green-800';
      case 'failed':  return 'bg-red-100 text-red-800';
      default:        return 'bg-gray-100 text-gray-600';
    }
  }

  /** Fetch latest status for both services on component init. */
  private loadSyncStatuses(): void {
    this.vsphereService.getSyncStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(s => this.syncStatuses['vsphere'] = s);

    this.newRelicService.getSyncStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(s => this.syncStatuses['newrelic'] = s);
  }

  // ── Manual sync trigger ────────────────────────────────────────────────────

  triggerSync(service: string): void {
    const trigger$ = service === 'vsphere'
      ? this.vsphereService.triggerSync()
      : this.newRelicService.triggerSync();

    trigger$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          this.syncStatuses[service] = status;
          if (status.status === 'running') {
            this.startPolling(service);
          }
        },
        error: () => {
          this.syncStatuses[service] = {
            service,
            status: 'failed',
            lastError: 'Failed to trigger sync. Check backend connectivity.'
          };
        }
      });
  }

  /**
   * Polls getSyncStatus every 3 s until the service exits the 'running' state.
   * takeWhile with inclusive=true emits the first non-running status so the
   * badge updates to success/failed before the observable completes.
   * takeUntilDestroyed cancels the interval if the component is destroyed
   * while a sync is still in flight.
   */
  private startPolling(service: string): void {
    if (this.polling[service]) {
      return;
    }
    this.polling[service] = true;

    const status$ = service === 'vsphere'
      ? this.vsphereService.getSyncStatus()
      : this.newRelicService.getSyncStatus();

    interval(3000)
      .pipe(
        switchMap(() => status$),
        takeWhile(s => s.status === 'running', true),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (s) => {
          this.syncStatuses[service] = s;
          if (s.status !== 'running') {
            this.polling[service] = false;
          }
        },
        complete: () => {
          this.polling[service] = false;
        },
        error: () => {
          this.polling[service] = false;
        }
      });
  }
}
