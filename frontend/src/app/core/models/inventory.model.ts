export interface Inventory {
  hostname: string;
  ipAddress: string;
  assetType: 'server' | 'vm' | 'container' | 'network';
  environment: 'production' | 'staging' | 'dev' | 'dr';
  owner?: string;
  location?: string;
  status: 'active' | 'maintenance' | 'decommissioned' | 'unknown';
  warrantyExpiry?: string;
  lastPatchedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryRequest {
  hostname: string;
  ipAddress: string;
  assetType: string;
  environment: string;
  owner?: string;
  location?: string;
  status?: string;
  warrantyExpiry?: string;
  lastPatchedAt?: string;
}

export interface AssetDetail {
  inventory: Inventory;
  vsphere?: VsphereData;
  newRelic?: NewRelicData;
}

export interface VsphereData {
  hostname: string;
  vmName: string;
  cpuCount?: number;
  cpuCores?: number;
  memoryMb?: number;
  memoryGb?: number;
  powerState?: string;
  guestOs?: string;
  toolsStatus?: string;
  ipv4Address?: string;
  ipv6Address?: string;
  lastSyncedAt?: string;
}

export interface NewRelicData {
  hostname: string;
  fullHostname?: string;
  ipv4Address?: string;
  ipv6Address?: string;
  processorCount?: number;
  coreCount?: number;
  systemMemoryBytes?: number;
  linuxDistribution?: string;
  service?: string;
  environment?: string;
  team?: string;
  location?: string;
  accountId?: string;
  createdAt?: string;
  updatedAt?: string;
}
