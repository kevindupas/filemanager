/**
 * Read Laravel's XSRF-TOKEN cookie. Inertia/axios send this automatically,
 * but resumable.js uses its own XHR, so we attach it as the X-XSRF-TOKEN
 * header manually. Laravel decrypts and validates it like any CSRF token.
 */
export function getXsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}
