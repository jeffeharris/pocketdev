// Test 1: Import from barrel export
import { Project as ProjectFromIndex } from './types';

// Test 2: Import directly
import { Project as ProjectDirect } from './types/project';

console.log('Testing imports...');
console.log('From index:', ProjectFromIndex);
console.log('Direct:', ProjectDirect);

export const test = { ProjectFromIndex, ProjectDirect };