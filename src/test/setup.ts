import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { transferableAbortController } from 'node:util';
// React Router uses Node's Request in jsdom. Keep its abort types in the
// same realm so Node 24's strict AbortSignal check accepts navigation requests.
const controller = transferableAbortController();
Object.assign(globalThis, {
  AbortController: controller.constructor,
  AbortSignal: controller.signal.constructor,
});
afterEach(cleanup);
