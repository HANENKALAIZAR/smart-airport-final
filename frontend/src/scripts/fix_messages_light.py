import re

file_path = r"c:\Users\gzhan\Downloads\smart-airport-postgres-feature-cleaned-up-the-chaos\frontend\src\pages\admin\SuperAdminMessages.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Refactor the main panels
content = content.replace(
    'border border-white/5 bg-white/[0.02]',
    'border dark:border-white/5 border-slate-200/60 dark:bg-white/[0.02] bg-white'
)

# Search bar background
content = content.replace(
    'bg-black/20 px-3 py-2.5 border border-white/10',
    'dark:bg-black/20 bg-slate-50 px-3 py-2.5 border dark:border-white/10 border-slate-200'
)

# Individual list items
content = content.replace(
    'border-b border-white/5',
    'border-b dark:border-white/5 border-slate-200/60'
)
content = content.replace(
    'hover:bg-white/5',
    'dark:hover:bg-white/5 hover:bg-slate-50'
)
content = content.replace(
    'bg-white/5 border-white/10 shadow-lg',
    'dark:bg-white/5 bg-white dark:border-white/10 border-slate-200 shadow-lg'
)

# Message detail header
content = content.replace(
    'bg-white/[0.02] border-b border-white/5',
    'dark:bg-white/[0.02] bg-white border-b dark:border-white/5 border-slate-200/60'
)

# Reply form background
content = content.replace(
    'bg-white/[0.02] border-t border-white/5',
    'dark:bg-white/[0.02] bg-slate-50 border-t dark:border-white/5 border-slate-200/60'
)

# Inner message bubbles (bot/system)
content = content.replace(
    'bg-white/5 border border-white/10',
    'dark:bg-white/5 bg-white border dark:border-white/10 border-slate-200/60'
)

# Active active thread bg
content = content.replace(
    'bg-white/10 border-white/10 shadow-lg',
    'dark:bg-white/10 bg-white dark:border-white/10 border-slate-200 shadow-md'
)

# Active folder bg
content = content.replace(
    'bg-white/10 border border-white/10 shadow-lg',
    'dark:bg-white/10 bg-white border dark:border-white/10 border-slate-200 shadow-md'
)

# "text-white" -> "text-white dark:text-white" except where it's in a gradient button where we actually want white in both, 
# wait, gradient buttons should keep text-white. We'll leave text-white alone unless it's a known issue.
# But "text-muted-foreground" is used, which adapts automatically if defined in globals.css.

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated SuperAdminMessages.tsx tailwind classes.")
