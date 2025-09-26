export function withBasePath(src: string) {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    if (!src || /^https?:\/\//i.test(src) || /^data:/i.test(src)) return src;
    const path = src.startsWith('/') ? src : `/${src}`;
    return `${basePath}${path}`;
}
  