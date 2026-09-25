// jsdom lacks a few browser APIs the components and phenomena use.
const g = globalThis as any
g.matchMedia ??= (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
g.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
g.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } }
g.HTMLCanvasElement.prototype.getContext = () => null
