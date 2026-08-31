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

## Core Functionality
- Group creation and management
- Channel assignment to multiple groups
- Feed filtering based on group membership
- Nested subgroup support
- Seamless integration with YouTube's UI

## Development Constraints
- Must maintain compatibility with YouTube's evolving interface
- Performance optimization is critical
- All changes must be tested across different YouTube layouts
- Follow Firefox extension security guidelines strictly
