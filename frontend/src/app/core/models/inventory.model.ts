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
  fqdn?: string;
  vmName: string;
  vmId: string;
  cluster?: string;
  datacenter?: string;
  datastore?: string;
  cpuCount?: number;
  cpuCores?: number;
  memoryMb?: number;
  memoryGb?: number;
  diskGb?: number;
  powerState?: string;
  guestOs?: string;
  toolsStatus?: string;
  ipv4Address?: string;
  ipv6Address?: string;
  lastSyncedAt?: string;
}

export interface NewRelicData {
  hostname: string;
  fqdn?: string;
  ipv4Address?: string;
  ipv6Address?: string;
  cpuCount?: number;
  cpuCores?: number;
  memoryGb?: number;
  guestOs?: string;
  application?: string;
  environment?: string;
  tags?: string;
  lastReportedAt?: string;
}
