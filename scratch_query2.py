import re

filepath = r'c:\Users\gzhan\Downloads\smart-airport-postgres-feature-cleaned-up-the-chaos\frontend\src\pages\admin\SuperAdminUsers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace primary with amber
content = re.sub(r'\btext-primary\b', 'text-amber', content)
content = re.sub(r'\bbg-primary\b', 'bg-amber', content)
content = re.sub(r'\bborder-primary\b', 'border-amber', content)
content = re.sub(r'\bring-primary\b', 'ring-amber', content)
content = re.sub(r'\bshadow-primary\b', 'shadow-amber', content)

# Adjust text on amber background
content = content.replace('bg-amber px-4 text-xs font-semibold text-background', 'bg-amber px-4 text-xs font-semibold text-navy-deep')
content = content.replace('text-background hover:bg-amber/95', 'text-navy-deep hover:bg-amber/90')

# Surfaces
content = content.replace('bg-[hsl(var(--surface-2))]/60', 'bg-navy-mid/60 backdrop-blur-md')
content = content.replace('bg-[hsl(var(--surface-2))]/50', 'bg-navy-mid/50 backdrop-blur-md')
content = content.replace('bg-[hsl(var(--surface-2))]/40', 'bg-navy-mid/40 backdrop-blur-md')
content = content.replace('bg-[hsl(var(--surface-2))]', 'bg-navy-mid')
content = content.replace('bg-[hsl(var(--surface-3))]', 'bg-navy-deep')

# Modals & Slate colors
content = content.replace('bg-slate-900/98', 'bg-navy-deep/95 backdrop-blur-xl')
content = content.replace('bg-slate-900/90', 'bg-navy-deep/90 backdrop-blur-lg')
content = content.replace('bg-slate-900', 'bg-navy-deep backdrop-blur-xl')
content = content.replace('bg-slate-950/20', 'bg-navy-deep/20')
content = content.replace('bg-slate-950/60', 'bg-navy-mid/60')
content = content.replace('bg-slate-950/80', 'bg-navy-mid/80')
content = content.replace('bg-slate-950', 'bg-navy-deep')

# Glass cards background update (admin cards & stat cards)
content = content.replace('glass-card group relative', 'glass-card group relative bg-gradient-to-br from-navy-mid to-navy-deep backdrop-blur-md border border-white/5')
content = content.replace('glass-card relative flex', 'glass-card relative flex bg-gradient-to-br from-navy-mid to-navy-deep backdrop-blur-md border border-white/5')

# Glow effects
content = content.replace('shadow-glow', 'shadow-[0_0_15px_oklch(0.78_0.16_75/0.15)]')

# Update StatusBadge meta - resubmitted was primary
# But the first replace changed primary to amber, so it already says:
# resubmitted: { label: "Resubmitted", tone: "border-amber/40 bg-amber/10 text-amber", icon: RefreshCw }
# This is perfect.

# Improve contrast for secondary text:
content = content.replace('text-muted-foreground', 'text-white/60')

# Smooth transitions (replace duration-200 with duration-250)
content = content.replace('duration-200', 'duration-250')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
