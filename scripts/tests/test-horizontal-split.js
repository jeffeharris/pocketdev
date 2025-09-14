// Test script to check horizontal split view behavior
// Run this in the browser console when on a task page

console.log('=== Testing Horizontal Split View ===');

// Get the current layout from the store
const getLayout = () => {
  const store = window.__zustand_stores?.find(s => s.name === 'split-view-store');
  if (!store) {
    console.error('Split view store not found');
    return null;
  }
  const state = store.getState();
  return state.currentLayout;
};

// Monitor layout changes
const monitorLayout = () => {
  let lastLayout = JSON.stringify(getLayout());
  
  const checkLayout = () => {
    const currentLayout = JSON.stringify(getLayout());
    if (currentLayout !== lastLayout) {
      console.log('Layout changed:', JSON.parse(currentLayout));
      lastLayout = currentLayout;
    }
  };
  
  // Check every 100ms for 5 seconds
  const interval = setInterval(checkLayout, 100);
  setTimeout(() => clearInterval(interval), 5000);
};

// Test sequence
console.log('1. Current layout:', getLayout());

// Find the split view toggle button
const splitButton = Array.from(document.querySelectorAll('button')).find(
  btn => btn.title?.includes('split view')
);

if (splitButton) {
  console.log('2. Found split view button, monitoring changes...');
  monitorLayout();
  
  // Check CSS variable
  const container = document.querySelector('.terminals-container');
  if (container) {
    const computedStyle = getComputedStyle(container);
    console.log('3. Initial CSS variable:', computedStyle.getPropertyValue('--split-ratio'));
    
    // Monitor CSS changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const newStyle = getComputedStyle(container);
          console.log('CSS variable changed:', newStyle.getPropertyValue('--split-ratio'));
        }
      });
    });
    
    observer.observe(container, { attributes: true, attributeFilter: ['style'] });
    
    // Clean up after 5 seconds
    setTimeout(() => observer.disconnect(), 5000);
  }
  
  console.log('4. Click the button to switch to split view and observe the console...');
} else {
  console.error('Split view button not found');
}

// Also check for the divider element
setTimeout(() => {
  const resizer = document.querySelector('[class*="cursor-row-resize"]');
  if (resizer) {
    console.log('5. Resizer found with style:', resizer.getAttribute('style'));
  }
}, 1000);