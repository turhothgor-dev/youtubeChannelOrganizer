# Project Overview: YouTube Groups Extension

## Purpose
This is a Firefox browser extension for YouTube that allows users to organize their subscribed channels into groups for better content filtering and organization.

## Technology Stack
- JavaScript (ES6+)
- YouTube DOM manipulation
- Firefox Extension APIs
- CSS for UI styling

## Architecture
The extension consists of:
1. Content script (`content.js`) - Runs in YouTube context
2. Manifest file (`manifest.json`) - Extension configuration
3. Storage utilities for persisting group data
4. UI components for group management

## Integration Points
- YouTube's video feed rendering
- Subscription management pages
- Video watch pages
- Channel browsing pages