/**
 * Native/default no-op. See blur-active-element.web.ts for the actual DOM
 * behavior — Metro resolves that file automatically on web builds, so
 * callers never need a Platform.OS branch and native code never touches
 * `document`.
 */
export function blurActiveElement(): void {}
