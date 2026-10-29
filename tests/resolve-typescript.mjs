// Resolve the app's extensionless relative TypeScript imports under native Node.
// Production modules are loaded unchanged; SDK/package resolution stays native.
import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.')) {
        for (const suffix of ['.ts', '/index.ts']) {
          try { return nextResolve(specifier + suffix, context); } catch {}
        }
      }
      throw error;
    }
  }
});
