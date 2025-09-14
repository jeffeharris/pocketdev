#!/usr/bin/env node

/**
 * Verification script to check that terminal selection dropdowns are now visible in quad view
 */

const puppeteer = require('puppeteer');

async function verifyQuadDropdownsFix() {
  console.log('Verifying quad view dropdown fix...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1600, height: 900 }
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
    
    // Switch to quad view (click split view button multiple times)
    console.log('Switching to quad view...');
    let attempts = 0;
    while (attempts < 4) {
      const splitButton = await page.$('button[title*="split view"]');
      if (splitButton) {
        await splitButton.click();
        await page.waitForTimeout(500);
      }
      
      // Check if we're in quad view
      const isQuadView = await page.$eval('.terminals-container', el => 
        el.classList.contains('mode-split-4')
      );
      
      if (isQuadView) {
        console.log('✅ Switched to quad view');
        break;
      }
      attempts++;
    }
    
    // Check dropdowns in quad view
    console.log('\nChecking dropdowns in quad view...');
    const quadDropdowns = await page.$$('.dropdown-container');
    console.log(`Dropdowns found: ${quadDropdowns.length}`);
    console.log(`Expected: 4 (one for each quadrant)\n`);
    
    // Check each dropdown's visibility and position
    for (let i = 0; i < quadDropdowns.length; i++) {
      const dropdown = quadDropdowns[i];
      const isVisible = await dropdown.isIntersectingViewport();
      const box = await dropdown.boundingBox();
      
      console.log(`Dropdown ${i + 1}:`);
      console.log(`  - Visible: ${isVisible ? '✅' : '❌'}`);
      
      if (box) {
        // Determine which quadrant based on position
        const viewportWidth = 1600;
        const viewportHeight = 900;
        const isLeft = box.x < viewportWidth / 2;
        const isTop = box.y < viewportHeight / 2;
        const quadrant = `${isTop ? 'top' : 'bottom'}-${isLeft ? 'left' : 'right'}`;
        
        console.log(`  - Quadrant: ${quadrant}`);
        console.log(`  - Position: x=${Math.round(box.x)}, y=${Math.round(box.y)}`);
      }
    }
    
    // Test dropdown functionality
    console.log('\nTesting dropdown functionality...');
    if (quadDropdowns.length > 0) {
      const firstButton = await quadDropdowns[0].$('button');
      if (firstButton) {
        await firstButton.click();
        await page.waitForTimeout(300);
        
        const dropdownMenu = await page.$('.dropdown-container .absolute.top-full');
        console.log(`Dropdown menu opens: ${dropdownMenu ? '✅' : '❌'}`);
        
        // Close dropdown
        await page.click('body');
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    if (quadDropdowns.length === 4) {
      const allVisible = await Promise.all(
        quadDropdowns.map(d => d.isIntersectingViewport())
      );
      
      if (allVisible.every(v => v === true)) {
        console.log('✅ SUCCESS: All 4 dropdowns are visible in quad view!');
      } else {
        console.log('⚠️  PARTIAL: Some dropdowns are not visible');
        allVisible.forEach((visible, i) => {
          if (!visible) console.log(`   - Dropdown ${i + 1} is not visible`);
        });
      }
    } else {
      console.log(`❌ FAILED: Expected 4 dropdowns, found ${quadDropdowns.length}`);
    }
    console.log('='.repeat(50));
    
    console.log('\nKeeping browser open for manual inspection...');
    console.log('Press Ctrl+C to exit');
    
    // Keep browser open
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Browser stays open
  }
}

// Run the verification
verifyQuadDropdownsFix().catch(console.error);