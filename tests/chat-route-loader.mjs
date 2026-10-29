import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier.startsWith('@/'))specifier=new URL('../'+specifier.slice(2),import.meta.url).href;
 if(specifier==='next/server')specifier='next/server.js';
 try{return nextResolve(specifier,context);}catch(error){if(error.code==='ERR_MODULE_NOT_FOUND'&&(specifier.startsWith('.')||specifier.startsWith('file:'))){for(const suffix of ['.ts','/index.ts']){try{return nextResolve(specifier+suffix,context);}catch{}}}throw error;}
}});
