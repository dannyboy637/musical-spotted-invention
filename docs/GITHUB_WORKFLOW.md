# GitHub Workflow Guide

> Quick reference for tracking bugs, features, and operational tasks.
> Repo: https://github.com/dannyboy637/musical-spotted-invention

---

## Quick Links

| Page | URL |
|------|-----|
| Issues List | https://github.com/dannyboy637/musical-spotted-invention/issues |
| Create Issue | https://github.com/dannyboy637/musical-spotted-invention/issues/new |
| Labels | https://github.com/dannyboy637/musical-spotted-invention/labels |

---

## Labels

| Label | Description | When to Use |
|-------|-------------|-------------|
| `bug` | Something isn't working | Broken functionality |
| `enhancement` | New feature or request | Improvements, new features |
| `ops` | Client tasks, data syncs, onboarding | Operational work |
| `documentation` | Docs improvements | README, guides |
| `priority: high` | Do this week | Urgent items |
| `priority: low` | Backlog | Can wait |
| `wontfix` | Won't be worked on | Declined requests |

---

## Creating an Issue (Step by Step)

### 1. Go to Issues
Click **Issues** tab or visit: https://github.com/dannyboy637/musical-spotted-invention/issues

### 2. Click "New Issue"
Green button on the right side

### 3. Fill in the Form

**Title:** Short and descriptive
- Good: "Bug: Top items missing item names in Branches"
- Bad: "Something broken"

**Body:** Use templates below

**Labels:** Click "Labels" in right sidebar, select:
- One type label: `bug` OR `enhancement` OR `ops`
- One priority: `priority: high` OR `priority: low`

### 4. Submit
Click "Submit new issue"

---

## Issue Templates

### Bug Report
```markdown
## Description
[What's broken - one sentence]

## Steps to Reproduce
1. Go to [page]
2. Click/do [action]
3. See [problem]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- Role: operator/owner/viewer
- Tenant: [which one]
- Browser: Chrome/Safari/Firefox
```

### Enhancement Request
```markdown
## Problem
[What problem does this solve?]

## Proposed Solution
[How should it work?]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Notes
[Any additional context, screenshots, examples]
```

---

## Working on an Issue

### Start Work
1. Open the issue
2. Click **"Assignees"** → Select yourself
3. Add a comment: "Starting work on this"

### During Work
- Reference issue in commits: `git commit -m "Fix: description #123"`
- The `#123` creates a link to the issue

### Complete Work
1. Add comment: "Fixed in commit abc123" or "Fixed in PR #X"
2. Click **"Close issue"** button

---

## Filtering Issues

### By Label
Click a label to filter, or use search:
```
label:bug
label:"priority: high"
label:bug label:"priority: high"
```

### By Status
```
is:open          # Open issues only
is:closed        # Closed issues only
```

### Combined
```
is:open label:bug label:"priority: high"
```

---

## Keyboard Shortcuts

Press `?` on any GitHub page to see all shortcuts.

| Key | Action |
|-----|--------|
| `g` `i` | Go to Issues |
| `c` | Create new issue (on Issues page) |
| `l` | Open label picker |
| `a` | Open assignee picker |
| `/` | Focus search |

---

## Daily Workflow

### Morning (5 min)
```
1. Open GitHub Issues
2. Filter: is:open label:"priority: high"
3. Review what needs attention
4. Pick what to work on today
```

### When Working
```
1. Assign yourself to issue
2. Work on it
3. Commit with issue reference
4. Close when done
```

### End of Day
```
1. Update issue with progress (if not done)
2. Close completed issues
```

---

## Weekly Review (Friday)

```
1. Review all open issues
2. Close any that are done
3. Re-prioritize based on feedback
4. Update BACKLOG.md if needed
5. Plan next week's focus
```

---

## Issue Lifecycle

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   CREATE          WORK            COMPLETE          │
│   ───────         ────            ────────          │
│                                                     │
│   New Issue  →  Assign Self  →  Close Issue         │
│   + Labels      + Comment       + Reference Commit  │
│                 "Starting"                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Prioritization Rules

When unsure what to work on:

| Priority | Condition |
|----------|-----------|
| **Fix now** | Something broken for a user |
| **High** | Client specifically asked |
| **Medium** | Helps onboard next client |
| **Low** | Nice to have |

---

## Connecting Issues to Code

### In Commit Messages
```bash
git commit -m "Fix: Top items now show item names #123"
```
This creates a link from the commit to issue #123.

### Auto-Close with Keywords
These keywords in commit messages auto-close issues:
- `Fixes #123`
- `Closes #123`
- `Resolves #123`

Example:
```bash
git commit -m "Fix: Settings now save default date range

Fixes #456"
```

---

## Tips

1. **One issue = one thing** - Don't combine multiple bugs/features
2. **Be specific** - "X doesn't work" is bad, "X shows Y instead of Z" is good
3. **Include context** - Steps to reproduce, screenshots help
4. **Close promptly** - Don't let done issues sit open
5. **Use labels** - They help you filter and prioritize

---

*See also: OPERATIONS_GUIDE.md for full operational workflow*
