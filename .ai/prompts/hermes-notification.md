# Hermes Notification Prompt

```text
Check the active task state and notify only if action is needed.

Inputs:
- TASK.md
- .ai/state/active-task.json
- .ai/memory/weekly-log.md

Notify when:
- no active task on a workday
- active task older than 2 days
- weekly review not created
- automation failed

Never include secrets from Hermes logs or state.
```

