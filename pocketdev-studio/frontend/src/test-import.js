// Test file to debug import issue
import * as shelltender from '@shelltender/client';

console.log('All exports from @shelltender/client:');
console.log(Object.keys(shelltender));
console.log('\nToastProvider exists?', 'ToastProvider' in shelltender);
console.log('ToastProvider value:', shelltender.ToastProvider);