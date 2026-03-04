import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'inventory/:hostname',
    loadComponent: () =>
      import('./features/inventory/inventory-detail.component').then(m => m.InventoryDetailComponent)
  },
  {
    path: 'vsphere',
    loadComponent: () =>
      import('./features/vsphere/vsphere-list.component').then(m => m.VsphereListComponent)
  },
  {
    path: 'newrelic',
    loadComponent: () =>
      import('./features/newrelic/newrelic-list.component').then(m => m.NewRelicListComponent)
  },
  {
    path: 'settings/credentials',
    loadComponent: () =>
      import('./features/settings/credentials/credentials.component').then(m => m.CredentialsComponent)
  },
  {
    path: 'settings/schedule',
    loadComponent: () =>
      import('./features/settings/schedule/schedule.component').then(m => m.ScheduleComponent)
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
