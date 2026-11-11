# Architecture rules
- Consulte `docs/CONTEXTO-DO-PROJETO.md` para a visão completa da arquitetura, diagramas de fluxo de negócio e contratos de API.
- Keep TanStack file routes and existing API services for navigation and external API access; this preserves the current app architecture.
- Assign customer account roles through the external API's user endpoints, never through local permission state; the API remains the authority for access control.
- Use collectPages before local filtering/ordering and SearchPagination for new result pagers; this avoids truncating catalogs or orders at a fixed fetch limit.
- Keep the sales summary rendering in SalesSummary and leaf metadata in pageHead; both isolate API normalization and consistent route metadata.
- Normalize stock-aware availability in the product API service; missing stock fields are unknown, not zero, while zero balances disable sales without mutating the API on reads.
- Order stock warnings use current product balances, never subtract ordered quantities again; checkout already records stock debits.
