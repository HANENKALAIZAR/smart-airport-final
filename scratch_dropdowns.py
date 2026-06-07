import re

filepath = r'c:\Users\gzhan\Downloads\smart-airport-postgres-feature-cleaned-up-the-chaos\frontend\src\pages\admin\SuperAdminUsers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update DropdownMenuContent
content = content.replace(
    'className="max-h-[320px] z-50 min-w-[240px] overflow-y-auto"',
    'className="max-h-[320px] z-[9999] min-w-[240px] overflow-y-auto bg-navy-deep border border-amber/20 shadow-xl shadow-[0_0_15px_rgba(245,158,11,0.1)] p-1 text-slate-100"'
)

# 2. Update DropdownMenuItem for All Airports
content = content.replace(
    'className={cn(airportFilter === "all" && "text-amber font-semibold")}',
    'className={cn("cursor-pointer focus:bg-amber/10 focus:text-amber hover:bg-amber/10 hover:text-amber transition-colors", airportFilter === "all" ? "text-amber bg-amber/10 font-semibold" : "text-slate-300")}'
)

# 3. Update DropdownMenuItem for specific Airport
content = content.replace(
    'className={cn(airportFilter === ap && "text-amber font-semibold")}',
    'className={cn("cursor-pointer focus:bg-amber/10 focus:text-amber hover:bg-amber/10 hover:text-amber transition-colors", airportFilter === ap ? "text-amber bg-amber/10 font-semibold" : "text-slate-300")}'
)

# 4. Update DropdownMenuItem for Verification Filters
content = content.replace(
    'className={cn(filter === f.key && "text-amber font-semibold")}',
    'className={cn("cursor-pointer focus:bg-amber/10 focus:text-amber hover:bg-amber/10 hover:text-amber transition-colors", filter === f.key ? "text-amber bg-amber/10 font-semibold" : "text-slate-300")}'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
