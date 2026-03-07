export interface VsphereRecord {
  hostname: string;
  fqdn?: string;
  vmName: string;
  vmId: string;
  datastore?: string;
  cpuCount?: number;
  cpuCores?: number;
  memoryMb?: number;
  memoryGb?: number;
  diskGb?: number;
  powerState?: 'poweredOn' | 'poweredOff' | 'suspended';
  guestOs?: string;
  toolsStatus?: string;
  ipv4Address?: string;
  ipv6Address?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}
