# Demo Resources

This directory contains resources for demonstrating PocketDev features.

## Demo Mode

To enable the demo panel in the UI:
1. Edit `web/.env.local`
2. Set `VITE_DEMO_MODE=true`
3. Restart the frontend container

The demo panel provides pre-configured scenarios to showcase:
- Pre-flight validation with supervisor interpretation
- Various error conditions
- Successful task completion flows

## Files in this Directory

- `DEMO-SCRIPT.md` - Step-by-step demo walkthrough
- `DEMO-CREDENTIALS.md` - Information about demo credentials setup
- `DEMO-TROUBLESHOOTING.md` - Troubleshooting guide for demo issues

## Demo Scenarios

When demo mode is enabled, you'll see a panel with scenarios like:
- **Everything Wrong** - Shows multiple validation errors with supervisor interpretation
- **Missing Credentials** - Valid task but missing API/Git credentials
- **Vague Task** - Task with insufficient details
- **Perfect Task** - Everything configured correctly (requires real credentials)