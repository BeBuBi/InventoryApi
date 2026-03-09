export interface Inventory {
  hostname: string;

  // vSphere fields
  vsphereIpv4?: string;
  vsphereIpv6?: string;
  vmName?: string;
  cpuCount?: number;
  cpuCores?: number;
  memoryMb?: number;
  memoryGb?: number;
  powerState?: string;
  guestOs?: string;
  toolsStatus?: string;
  vsphereLastSynced?: string;

  // New Relic fields
  fullHostname?: string;
  nrIpv4?: string;
  nrIpv6?: string;
  processorCount?: number;
  coreCount?: number;
  systemMemoryBytes?: number;
  linuxDistribution?: string;
  service?: string;
  nrEnvironment?: string;
  team?: string;
  nrLocation?: string;
  accountId?: string;

  // CMDB fields
  sysId?: string;
  os?: string;
  osVersion?: string;
  cmdbIpAddress?: string;
  cmdbLocation?: string;
  department?: string;
  cmdbEnvironment?: string;
  operationalStatus?: string;
  classification?: string;
  cmdbLastSynced?: string;

  // Meta
  sources?: string;
}

export interface InventoryCounts {
  total: number;
  vsphere: number;
  newrelic: number;
  cmdb: number;
}
