export interface PlatformCapability {
  id: string;
  title: string;
  description: string;
  image: string;
  href: string;
}

export interface ArchitectureStep {
  id: number;
  title: string;
  description: string;
  image?: string;
}
