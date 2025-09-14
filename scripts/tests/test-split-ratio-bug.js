// Test to verify split ratio normalization issue
// Run this in the browser console on the test-services task

console.log('=== Testing Split Ratio Bug Hypothesis ===');

// Access the split view store
const getStore = () => {
  if (window.__zustand_stores) {
    return window.__zustand_stores.find(s => s?.name === 'split-view-store');
  }
  // Try alternative methods
  const root = document.querySelector('#root')._reactRootContainer?._internalRoot?.current;
  if (root) {
    // Try to find store in React tree
    console.log('Trying React tree method...');
  }
  return null;
};

const store = getStore();
if (!store) {
  console.error('Could not find split view store');
} else {
  const state = store.getState();
  console.log('Current split view state:', {
    currentTaskId: state.currentTaskId,
    currentLayout: state.currentLayout,
    splitRatio: state.currentLayout?.splitRatio,
    splitRatioType: typeof state.currentLayout?.splitRatio
  });
  
  // Check if split ratio is in percentage range (>1)
  if (state.currentLayout?.splitRatio > 1) {
    console.log('⚠️ FOUND THE BUG: Split ratio is in percentage format:', state.currentLayout.splitRatio);
    console.log('This should be a decimal between 0 and 1');
    
    // Test fix
    console.log('\nTo fix temporarily, run:');
    console.log(`store.getState().setSplitRatio(${state.currentLayout.splitRatio / 100})`);
  } else {
    console.log('✓ Split ratio appears to be in correct decimal format');
  }
}

// Also check localStorage for saved layout
console.log('\nChecking localStorage for saved layouts...');
const taskId = window.location.pathname.match(/tasks\/([^/]+)/)?.[1];
if (taskId) {
  // Check for old percentage-based values
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.includes('split') || key.includes('layout')) {
      try {
        const value = JSON.parse(localStorage.getItem(key));
        if (value?.splitRatio > 1) {
          console.log(`Found percentage value in ${key}:`, value);
        }
      } catch (e) {
        // Not JSON, skip
      }
    }
  }
}

// Monitor the CSS variable
const container = document.querySelector('.terminals-container');
if (container) {
  const style = getComputedStyle(container);
  const cssVar = style.getPropertyValue('--split-ratio');
  console.log('\nCSS variable --split-ratio:', cssVar);
  
  // If it's showing a percentage > 100%, that confirms the bug
  if (cssVar && parseFloat(cssVar) > 100) {
    console.log('⚠️ CSS variable confirms the bug - value is way too high!');
  }
}

console.log('\nNext steps:');
console.log('1. Switch to horizontal split and observe the console');
console.log('2. The issue should show a split ratio > 1 when it occurs');