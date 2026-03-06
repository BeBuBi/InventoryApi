export interface NewRelicRecord {
  hostname: string;
  accountId?: string;
  location?: string;
  environment?: string;
  team?: string;
  service?: string;
  ipv4Address?: string;
  ipv6Address?: string;
  processorCount?: number;
  coreCount?: number;
  systemMemoryBytes?: number;
  linuxDistribution?: string;
  createdAt: string;
  updatedAt: string;
}
