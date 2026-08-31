# Project Rules and Guidelines

## Project Overview
This is a YouTube Groups Firefox browser extension built with JavaScript that allows users to organize their subscribed channels into groups for better content filtering and organization.

## Key Features
- Create and manage groups of YouTube channels
- Assign channels to multiple groups
- Filter YouTube video feed based on group membership
- Support for nested subgroups
- User-friendly interface integrated with YouTube's design

## Technical Constraints
- Do not add functionality, modify or refactor code unless explicitly instructed
- Must work within YouTube's DOM structure and APIs
- Follow Firefox extension security guidelines
- Performance is critical - avoid expensive operations in loops
- Handle edge cases for different YouTube layouts and page states
- Maintain backward compatibility with existing features

## Coding Standards
- Follow the existing JavaScript patterns in the codebase
- Maintain consistent naming conventions (camelCase for variables, PascalCase for constructors)
- All functions should have JSDoc comments explaining parameters and return values
- Use descriptive variable names that clearly indicate their purpose
- Follow the existing code style and formatting patterns

## File Structure
- `content.js` - Main extension logic running in YouTube context
- `manifest.json` - Extension metadata and permissions
- `modules/` - Supporting modules and utilities
- `path/` - Path-related utilities
- `content.css` - Extension styling

## Development Process
1. Always examine the existing codebase before implementing new features
2. Follow the established patterns and conventions
3. Ensure backward compatibility with existing functionality
4. Test thoroughly in different YouTube contexts
5. Write clear, descriptive commit messages
6. Include appropriate tests where applicable
7. Update documentation for any API changes
8. Document complex logic with inline comments
9. Validate that existing features aren't broken
10. Proposed code changes must be locatable in the source code


## Testing Strategy
- Test in various YouTube contexts (subscriptions, watch pages, home feed)
- Verify performance impact on page load times
- Check compatibility across different YouTube layouts
- Validate that existing features aren't broken

## Security Considerations
- Never expose sensitive information
- Validate all inputs from YouTube's DOM
- Follow Firefox extension security best practices
- Avoid executing unsafe code or eval statements