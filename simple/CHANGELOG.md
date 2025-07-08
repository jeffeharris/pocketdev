# Changelog

All notable changes to the PocketDev Simple Server will be documented in this file.

## [Unreleased]

### Added
- Upgraded @shelltender/client from v0.4.0 to v0.4.3 for terminal focus/fit API support
- Implemented automatic terminal focus when:
  - Page loads initially
  - Switching between tasks
  - Returning from another browser tab
  - Window regains focus
  - Closing modals (Create Task modal)
- Added DOM-based fallback for terminal focus due to v0.4.3 bundler issue
- Added comprehensive documentation for Shelltender upgrade process
- Added WebSocketProvider configuration for proper WebSocket URL handling

### Changed
- Updated DirectTerminal component to use new TerminalHandle ref API
- Improved terminal auto-focus behavior with multiple trigger points
- Enhanced TaskWorkspace with focusActiveTerminal helper function
- Terminal now uses `/shelltender-ws` proxy path consistently

### Fixed
- Terminal focus now works immediately when switching tasks (using DOM fallback)
- Terminal properly resizes when window size changes
- Fixed TypeScript import for TerminalHandle type (must use `import type`)

### Known Issues
- @shelltender/client v0.4.3 has a bug where forwardRef is stripped by Vite's bundler
  - Using DOM fallback (.xterm-helper-textarea) until v0.4.4 is released
  - Shelltender team has confirmed fix using Object.assign() pattern

### Documentation
- Added detailed Shelltender upgrade guides in `simple/docs/shelltender/`
- Documented investigation of v0.4.3 ref forwarding issue
- Added implementation notes for future Shelltender upgrades