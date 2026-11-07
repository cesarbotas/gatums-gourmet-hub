# Architecture rules
- Keep TanStack file routes and existing API services for navigation and external API access; this preserves the current app architecture.
- Assign customer account roles through the external API's user endpoints, never through local permission state; the API remains the authority for access control.