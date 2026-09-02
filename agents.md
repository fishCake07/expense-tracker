# Agent Operating Rules

1. **Commit Cadence**: Every completed change, feature, or bugfix must produce a Git commit with a clear, descriptive summary.
2. **Pre-Delivery Verification**: Every modification requires running automated self-checks and testing to verify functionality, responsiveness, and persistence before handing off to the user.
3. **No Unapproved Breaking Changes**: Maintain backward compatibility for saved local data (`localStorage`).
4. **Clean Codebase**: Keep code modular, well-commented, and lightweight with zero unnecessary external bloat.
