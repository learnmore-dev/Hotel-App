type UnauthorizedHandler = () => void;
type TokenRefreshedHandler = (token: string) => void;

let unauthorizedHandler: UnauthorizedHandler | undefined;
let tokenRefreshedHandler: TokenRefreshedHandler | undefined;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | undefined): void {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized(): void {
  unauthorizedHandler?.();
}

export function setTokenRefreshedHandler(handler: TokenRefreshedHandler | undefined): void {
  tokenRefreshedHandler = handler;
}

export function notifyTokenRefreshed(token: string): void {
  tokenRefreshedHandler?.(token);
}
