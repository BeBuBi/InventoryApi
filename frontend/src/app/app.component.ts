import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen bg-gray-50">
      <!-- Sidebar -->
      <nav class="w-56 bg-gray-900 text-white flex flex-col">
        <div class="px-6 py-5 text-lg font-bold tracking-wide border-b border-gray-700">
          Server Inventory
        </div>
        <ul class="flex-1 py-4 space-y-1">
          <li>
            <a routerLink="/dashboard" routerLinkActive="bg-gray-700"
               class="flex items-center px-6 py-2 text-sm hover:bg-gray-700 rounded mx-2 transition-colors">
              Dashboard
            </a>
          </li>
          <li>
            <a routerLink="/vsphere" routerLinkActive="bg-gray-700"
               class="flex items-center px-6 py-2 text-sm hover:bg-gray-700 rounded mx-2 transition-colors">
              vSphere
            </a>
          </li>
          <li>
            <a routerLink="/newrelic" routerLinkActive="bg-gray-700"
               class="flex items-center px-6 py-2 text-sm hover:bg-gray-700 rounded mx-2 transition-colors">
              New Relic
            </a>
          </li>
          <li class="pt-4 px-6 text-xs text-gray-500 uppercase tracking-wider">Settings</li>
          <li>
            <a routerLink="/settings/credentials" routerLinkActive="bg-gray-700"
               class="flex items-center px-6 py-2 text-sm hover:bg-gray-700 rounded mx-2 transition-colors">
              Credentials
            </a>
          </li>
          <li>
            <a routerLink="/settings/schedule" routerLinkActive="bg-gray-700"
               class="flex items-center px-6 py-2 text-sm hover:bg-gray-700 rounded mx-2 transition-colors">
              Sync Schedule
            </a>
          </li>
        </ul>
      </nav>

      <!-- Main content -->
      <main class="flex-1 overflow-auto">
        <router-outlet />
      </main>
    </div>
  `
})
export class AppComponent {}
