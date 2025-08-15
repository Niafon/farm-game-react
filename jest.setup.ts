import '@testing-library/jest-dom';

// Polyfills for Web APIs used by viem/wagmi in Jest (node) environment
import { TextEncoder, TextDecoder } from 'util'
import { webcrypto as cryptoWeb } from 'node:crypto'
// @ts-expect-error provide node polyfills for jsdom
if (!(global as any).TextEncoder) (global as any).TextEncoder = TextEncoder
// @ts-expect-error provide node polyfills for jsdom
if (!(global as any).TextDecoder) (global as any).TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder
// crypto.getRandomValues for SIWE nonce
// @ts-expect-error jsdom global
if (!(global as any).crypto) (global as any).crypto = cryptoWeb
