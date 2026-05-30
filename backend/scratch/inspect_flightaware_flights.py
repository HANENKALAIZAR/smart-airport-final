import asyncio
import os
import sys
import httpx

# Add backend to path
sys.path.append(os.path.abspath("backend"))

from app.config import settings

async def main():
    fa_key = settings.FLIGHTAWARE_API_KEY
    headers = {"x-apikey": fa_key}
    
    url = "https://aeroapi.flightaware.com/aeroapi/flights/DLH1327"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code == 200:
            flights = resp.json().get("flights", [])
            print(f"Found {len(flights)} flights for DLH1327:")
            for i, f in enumerate(flights):
                print(f"[{i}] ident: {f.get('ident')}, status: {f.get('status')}")
                print(f"    scheduled_out: {f.get('scheduled_out')}")
                print(f"    scheduled_in:  {f.get('scheduled_in')}")
                print(f"    actual_out:    {f.get('actual_out')}")
                print(f"    actual_in:     {f.get('actual_in')}")
                print(f"    progress_percent: {f.get('progress_percent')}")
                print(f"    gate_origin: {f.get('gate_origin')}, gate_destination: {f.get('gate_destination')}")
        else:
            print("Failed:", resp.status_code, resp.text)

if __name__ == "__main__":
    asyncio.run(main())
