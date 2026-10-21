export interface PlatformCapability {
  id: string;
  title: string;
  description: string;
  image: string;
  /** The same image in a modern format (WebP); `image` is its fallback. */
  imageModern?: string;
  href: string;
}

export interface ArchitectureStep {
  id: number;
  title: string;
  description: string;
  image?: string;
}
