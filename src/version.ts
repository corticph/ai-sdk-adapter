declare const PACKAGE_VERSION: string;
export const ADAPTER_VERSION: string =
  typeof PACKAGE_VERSION !== 'undefined' ? PACKAGE_VERSION : 'dev';
