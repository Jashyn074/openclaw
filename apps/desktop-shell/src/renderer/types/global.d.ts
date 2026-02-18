type DesktopShellApi = {
  getGatewayUrl: () => string;
};

declare global {
  interface Window {
    openclawDesktop: DesktopShellApi;
  }
}


