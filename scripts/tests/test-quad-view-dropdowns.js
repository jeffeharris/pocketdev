#!/usr/bin/env node

/**
 * Test script to verify terminal selection dropdown visibility in quad view
 */

const puppeteer = require('puppeteer');

async function testQuadViewDropdowns() {
  console.log('Testing terminal selection dropdowns in different view modes...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1600, height: 900 },
    devtools: true
  });

  try {
    const page = await browser.newPage();
    
    // Navigate to the application
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    
    // Wait for a task to be available and click it
    await page.waitForSelector('[data-testid="task-item"]', { timeout: 10000 });
    await page.click('[data-testid="task-item"]:first-child');
    
    // Wait for terminal panel to load
    await page.waitForSelector('.terminals-container', { timeout: 10000 });
    
    // Test 1: Check dropdowns in tab mode (default)
    console.log('Test 1: Tab mode (default)');
    const tabModeDropdowns = await page.$$('.dropdown-container');
    console.log(`  - Dropdowns found: ${tabModeDropdowns.length}`);
    console.log(`  - Expected: 0 (no dropdowns in tab mode)\n`);
    
    // Test 2: Switch to vertical split view
    console.log('Test 2: Switching to vertical split view...');
    const splitButton = await page.$('button[title*="Enable split view"]');
    if (splitButton) {
      await splitButton.click();
      await page.waitForTimeout(500);
    }
    
    const verticalSplitDropdowns = await page.$$('.dropdown-container');
    console.log(`  - Dropdowns found: ${verticalSplitDropdowns.length}`);
    console.log(`  - Expected: 2 (one for each pane)\n`);
    
    // Check if dropdowns are visible
    for (let i = 0; i < verticalSplitDropdowns.length; i++) {
      const isVisible = await verticalSplitDropdowns[i].isIntersectingViewport();
      console.log(`  - Dropdown ${i + 1} visible: ${isVisible}`);
    }
    
    // Test 3: Switch to horizontal split view
    console.log('\nTest 3: Switching to horizontal split view...');
    const horizontalButton = await page.$('button[title*="horizontal split"]');
    if (horizontalButton) {
      await horizontalButton.click();
      await page.waitForTimeout(500);
    }
    
    const horizontalSplitDropdowns = await page.$$('.dropdown-container');
    console.log(`  - Dropdowns found: ${horizontalSplitDropdowns.length}`);
    console.log(`  - Expected: 2 (one for each pane)\n`);
    
    // Check if dropdowns are visible
    for (let i = 0; i < horizontalSplitDropdowns.length; i++) {
      const isVisible = await horizontalSplitDropdowns[i].isIntersectingViewport();
      console.log(`  - Dropdown ${i + 1} visible: ${isVisible}`);
    }
    
    // Test 4: Switch to quad view
    console.log('\nTest 4: Switching to quad view...');
    const quadButton = await page.$('button[title*="quad view"]');
    if (quadButton) {
      await quadButton.click();
      await page.waitForTimeout(500);
    }
    
    const quadDropdowns = await page.$$('.dropdown-container');
    console.log(`  - Dropdowns found: ${quadDropdowns.length}`);
    console.log(`  - Expected: 4 (one for each quadrant)\n`);
    
    // Check if dropdowns are visible and get their positions
    for (let i = 0; i < quadDropdowns.length; i++) {
      const dropdown = quadDropdowns[i];
      const isVisible = await dropdown.isIntersectingViewport();
      const box = await dropdown.boundingBox();
      console.log(`  - Dropdown ${i + 1}:`);
      console.log(`    - Visible: ${isVisible}`);
      if (box) {
        console.log(`    - Position: x=${box.x}, y=${box.y}`);
        console.log(`    - Size: ${box.width}x${box.height}`);
      }
    }
    
    // Test 5: Check CSS positioning
    console.log('\nTest 5: Checking CSS positioning...');
    const dropdownStyles = await page.evaluate(() => {
      const dropdowns = document.querySelectorAll('.dropdown-container');
      return Array.from(dropdowns).map((el, i) => {
        const computed = window.getComputedStyle(el);
        const parent = el.parentElement;
        const parentComputed = parent ? window.getComputedStyle(parent) : null;
        return {
          index: i,
          position: computed.position,
          top: computed.top,
          left: computed.left,
          right: computed.right,
          bottom: computed.bottom,
          zIndex: computed.zIndex,
          display: computed.display,
          visibility: computed.visibility,
          parentPosition: parentComputed?.position,
          parentTop: parentComputed?.top,
          parentLeft: parentComputed?.left
        };
      });
    });
    
    dropdownStyles.forEach(style => {
      console.log(`\n  Dropdown ${style.index + 1} styles:`);
      console.log(`    - Position: ${style.position}`);
      console.log(`    - Top: ${style.top}, Left: ${style.left}`);
      console.log(`    - Right: ${style.right}, Bottom: ${style.bottom}`);
      console.log(`    - Z-index: ${style.zIndex}`);
      console.log(`    - Display: ${style.display}`);
      console.log(`    - Visibility: ${style.visibility}`);
      console.log(`    - Parent position: ${style.parentPosition}`);
      console.log(`    - Parent top: ${style.parentTop}, left: ${style.parentLeft}`);
    });
    
    // Test 6: Check if dropdowns are clickable
    console.log('\nTest 6: Testing dropdown interactivity...');
    try {
      const firstDropdownButton = await page.$('.dropdown-container button');
      if (firstDropdownButton) {
        await firstDropdownButton.click();
        await page.waitForTimeout(200);
        
        const dropdownMenu = await page.$('.dropdown-container .absolute.top-full');
        console.log(`  - Dropdown menu appeared: ${!!dropdownMenu}`);
        
        if (dropdownMenu) {
          const menuVisible = await dropdownMenu.isIntersectingViewport();
          console.log(`  - Dropdown menu visible: ${menuVisible}`);
        }
      }
    } catch (error) {
      console.log(`  - Error clicking dropdown: ${error.message}`);
    }
    
    console.log('\n✅ Test completed. Please check the browser window to visually verify dropdowns.');
    console.log('Press Ctrl+C to exit...');
    
    // Keep browser open for manual inspection
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Browser will stay open for inspection
  }
}

// Run the test
testQuadViewDropdowns().catch(console.error);