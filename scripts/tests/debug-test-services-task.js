// Debug script to check test-services task state
// Run this in the browser console when viewing the test-services task

console.log('=== Debugging test-services task ===');

// Get all tasks from the page
const getAllTasks = () => {
  // Try to find task info from the current URL or page state
  const url = window.location.pathname;
  const taskIdMatch = url.match(/tasks\/([^/]+)/);
  const currentTaskId = taskIdMatch ? taskIdMatch[1] : null;
  
  console.log('Current task ID from URL:', currentTaskId);
  
  // Check local storage for task-specific data
  const storage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.includes(currentTaskId) || key.includes('test-services')) {
      storage[key] = localStorage.getItem(key);
    }
  }
  
  console.log('Local storage entries for this task:', storage);
  
  // Check session storage too
  const sessionData = {};
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key.includes(currentTaskId) || key.includes('test-services')) {
      sessionData[key] = sessionStorage.getItem(key);
    }
  }
  
  console.log('Session storage entries for this task:', sessionData);
  
  return { currentTaskId, storage, sessionData };
};

// Get split view store state
const getSplitViewState = () => {
  // Try to access the Zustand store
  const stores = window.__zustand_stores || [];
  const splitStore = stores.find(s => s?.name === 'split-view-store');
  
  if (splitStore) {
    const state = splitStore.getState();
    console.log('Split view store state:', {
      currentTaskId: state.currentTaskId,
      currentLayout: state.currentLayout,
      layoutState: state.layoutState,
      layoutError: state.layoutError
    });
    return state;
  }
  
  // Fallback: try to find it in React DevTools
  console.log('Split view store not found in window.__zustand_stores');
  return null;
};

// Get terminal store state
const getTerminalState = () => {
  const stores = window.__zustand_stores || [];
  const terminalStore = stores.find(s => s?.name === 'terminal-store');
  
  if (terminalStore) {
    const state = terminalStore.getState();
    const taskData = getAllTasks();
    const taskId = taskData.currentTaskId;
    
    if (taskId) {
      console.log('Terminal store state for task:', {
        taskId,
        terminals: state.taskTerminals[taskId] || [],
        activeTerminal: state.activeTerminals[taskId],
        focusedTerminal: state.focusedTerminals[taskId]
      });
    }
    return state;
  }
  
  console.log('Terminal store not found');
  return null;
};

// Check the actual DOM state
const checkDOMState = () => {
  const container = document.querySelector('.terminals-container');
  if (container) {
    const classes = container.className;
    const style = container.getAttribute('style');
    const computedStyle = getComputedStyle(container);
    
    console.log('Terminal container DOM state:', {
      classes,
      inlineStyle: style,
      splitRatio: computedStyle.getPropertyValue('--split-ratio'),
      display: computedStyle.display,
      gridTemplateRows: computedStyle.gridTemplateRows,
      gridTemplateColumns: computedStyle.gridTemplateColumns
    });
  }
  
  // Check for resizer
  const resizer = document.querySelector('[class*="cursor-row-resize"], [class*="cursor-col-resize"]');
  if (resizer) {
    console.log('Resizer element:', {
      className: resizer.className,
      style: resizer.getAttribute('style')
    });
  }
};

// Run all checks
console.log('\n1. Task information:');
getAllTasks();

console.log('\n2. Split view state:');
getSplitViewState();

console.log('\n3. Terminal state:');
getTerminalState();

console.log('\n4. DOM state:');
checkDOMState();

console.log('\n5. To monitor changes, run: monitorChanges()');

// Monitor function
window.monitorChanges = () => {
  console.log('Monitoring DOM changes for 10 seconds...');
  
  const container = document.querySelector('.terminals-container');
  if (!container) {
    console.error('Terminal container not found');
    return;
  }
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] Attribute changed:`, {
          attribute: mutation.attributeName,
          oldValue: mutation.oldValue,
          newValue: mutation.target.getAttribute(mutation.attributeName)
        });
        
        if (mutation.attributeName === 'style' || mutation.attributeName === 'class') {
          const computedStyle = getComputedStyle(container);
          console.log('  Updated computed styles:', {
            splitRatio: computedStyle.getPropertyValue('--split-ratio'),
            gridTemplateRows: computedStyle.gridTemplateRows,
            gridTemplateColumns: computedStyle.gridTemplateColumns
          });
        }
      }
    });
  });
  
  observer.observe(container, {
    attributes: true,
    attributeOldValue: true,
    subtree: false
  });
  
  setTimeout(() => {
    observer.disconnect();
    console.log('Monitoring stopped');
  }, 10000);
};