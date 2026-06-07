import re

filepath = r'c:\Users\gzhan\Downloads\smart-airport-postgres-feature-cleaned-up-the-chaos\frontend\src\pages\admin\SuperAdminUsers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Name input in modal
content = re.sub(
    r'className="h-10 w-full rounded-lg border border-border bg-navy-mid/60 px-3 text-sm text-white outline-none focus:border-amber/50"',
    'className="h-10 w-full rounded-lg border border-slate-700 bg-navy-deep px-3 text-sm text-white placeholder:text-slate-400 outline-none focus:border-amber focus:ring-1 focus:ring-amber transition-all"',
    content
)

# 2. Generated login email in modal
content = re.sub(
    r'className=\{cn\(\n\s*"h-10 w-full rounded-lg border bg-navy-mid/60 px-3 text-sm text-white outline-none focus:border-amber/50",',
    'className={cn(\n                        "h-10 w-full rounded-lg border border-slate-700 bg-navy-deep px-3 text-sm text-white placeholder:text-slate-400 outline-none focus:border-amber focus:ring-1 focus:ring-amber transition-all",',
    content
)

# 3. Personal email in modal
content = re.sub(
    r'className=\{cn\(\n\s*"h-10 w-full rounded-lg border bg-navy-mid/60 px-3 text-sm text-white outline-none focus:border-amber/50",',
    'className={cn(\n                        "h-10 w-full rounded-lg border border-slate-700 bg-navy-deep px-3 text-sm text-white placeholder:text-slate-400 outline-none focus:border-amber focus:ring-1 focus:ring-amber transition-all",',
    content
)

# 4. Airport selection in modal
content = re.sub(
    r'className="h-10 w-full rounded-lg border border-border bg-navy-mid/60 px-3 text-sm text-white outline-none cursor-pointer focus:border-amber/50"',
    'className="h-10 w-full rounded-lg border border-slate-700 bg-navy-deep px-3 text-sm text-white outline-none cursor-pointer focus:border-amber focus:ring-1 focus:ring-amber transition-all"',
    content
)

# Add bg-navy-deep to option tags to fix the dropdown appearing white
content = re.sub(
    r'<option key=\{a.iata\} value=\{a.iata\}>',
    '<option key={a.iata} value={a.iata} className="bg-navy-deep text-white">',
    content
)

# 5. Textarea for rejection note
content = re.sub(
    r'className="w-full resize-none rounded-lg border border-border bg-navy-mid/60 backdrop-blur-md p-3 text-sm text-foreground outline-none transition-colors duration-250 placeholder:text-white/60 focus:border-amber/50"',
    'className="w-full resize-none rounded-lg border border-slate-700 bg-navy-deep p-3 text-sm text-white placeholder:text-slate-400 outline-none transition-colors duration-250 focus:border-amber focus:ring-1 focus:ring-amber"',
    content
)

# 6. Search input (for consistency, though they didn't explicitly mention it)
content = re.sub(
    r'className="h-10 w-full rounded-lg border border-border bg-navy-mid/60 backdrop-blur-md pl-9 pr-3 text-sm outline-none transition-colors duration-250 placeholder:text-white/60 focus:border-amber/50"',
    'className="h-10 w-full rounded-lg border border-slate-700 bg-navy-deep pl-9 pr-3 text-sm text-white outline-none transition-colors duration-250 placeholder:text-slate-400 focus:border-amber focus:ring-1 focus:ring-amber"',
    content
)

# Ensure the submit button text is navy-deep (I did text-navy-deep before, but maybe hover is missing something)
# "The Send Invitation button should stay amber, but use dark navy text and proper hover glow."
content = re.sub(
    r'className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber px-4 text-xs font-semibold text-navy-deep transition-colors hover:bg-amber/95 shadow-\[0_0_15px_oklch\(0\.78_0\.16_75/0\.15\)\] disabled:opacity-40"',
    'className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber px-4 text-xs font-semibold text-navy-deep transition-all hover:bg-amber/90 shadow-[0_0_15px_oklch(0.78_0.16_75/0.2)] hover:shadow-[0_0_20px_oklch(0.78_0.16_75/0.4)] disabled:opacity-40"',
    content
)


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
