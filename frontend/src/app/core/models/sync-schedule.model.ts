export interface SyncSchedule {
  id: number;
  service: 'vsphere' | 'newrelic';
  cronExpr: string;
  enabled: boolean;
  description?: string;
  lastRunAt?: string;
  updatedAt: string;
}

export interface SyncScheduleRequest {
  service: string;
  cronExpr: string;
  enabled: boolean;
  description?: string;
}

export interface SyncStatus {
  service: string;
  status: 'idle' | 'running' | 'success' | 'failed';
  lastRunAt?: string;
  lastError?: string;
}
