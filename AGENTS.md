# Architecture rules
- Keep TanStack file routes and existing API services for navigation and external API access; this preserves the current app architecture.
- Assign customer account roles through the external API's user endpoints, never through local permission state; the API remains the authority for access control.
- Use collectPages before local filtering/ordering and SearchPagination for new result pagers; this avoids truncating catalogs or orders at a fixed fetch limit.
- Keep the sales summary rendering in SalesSummary and leaf metadata in pageHead; both isolate API normalization and consistent route metadata.