const publicBaseUrl = import.meta.env.BASE_URL || '/';

export function getPublicAssetUrl(assetPath: string): string {
  return `${publicBaseUrl}${assetPath.replace(/^\/+/, '')}`;
}

export const appLogoUrl = getPublicAssetUrl('logo.png');