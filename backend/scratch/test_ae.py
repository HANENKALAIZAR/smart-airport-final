import httpx
import json

KEY = "25178f-46404d"
url = f"https://aviation-edge.com/v2/public/timetable?key={KEY}&iataCode=TUN&type=departure"

try:
    r = httpx.get(url, timeout=10.0)
    print(f"Status code: {r.status_code}")
    data = r.json()
    if isinstance(data, dict) and data.get("error"):
        print(f"Error returned from API: {data}")
    else:
        print(f"Success! Returned list size: {len(data) if isinstance(data, list) else 'Not a list'}")
        if isinstance(data, list) and len(data) > 0:
            print(f"Sample: {json.dumps(data[0], indent=2)}")
except Exception as e:
    print(f"Exception: {e}")
