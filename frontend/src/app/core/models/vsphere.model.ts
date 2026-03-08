export interface VsphereRecord {
  hostname: string;
  vmName: string;
  cpuCount?: number;
  cpuCores?: number;
  memoryMb?: number;
  memoryGb?: number;
  powerState?: 'poweredOn' | 'poweredOff' | 'suspended';
  guestOs?: string;
  toolsStatus?: string;
  ipv4Address?: string;
  ipv6Address?: string;
  sourceUrl?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}
