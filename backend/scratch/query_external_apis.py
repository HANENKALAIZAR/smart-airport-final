import asyncio
import os
import sys
import httpx
from pathlib import Path

# Add backend to path
sys.path.append(os.path.abspath("backend"))

from app.config import settings

async def main():
    ae_key = settings.AVIATION_EDGE_KEY
    fa_key = settings.FLIGHTAWARE_API_KEY
    
    print(f"AE Key: {ae_key}")
    print(f"FA Key: {fa_key}")
    
    async with httpx.AsyncClient() as client:
        # 1. Aviation Edge timetable query
        url = "https://aviation-edge.com/v2/public/timetable"
        params = {"key": ae_key, "flightIata": "AC9277"}
        try:
            resp = await client.get(url, params=params)
            print("\nAviation Edge Timetable (AC9277) Response:")
            print(resp.status_code)
            print(resp.json())
        except Exception as e:
            print("AE Timetable AC9277 failed:", e)

        params = {"key": ae_key, "flightIata": "LH1327"}
        try:
            resp = await client.get(url, params=params)
            print("\nAviation Edge Timetable (LH1327) Response:")
            print(resp.status_code)
            print(resp.json())
        except Exception as e:
            print("AE Timetable LH1327 failed:", e)

        # 2. Aviation Edge live tracker query
        url = "https://aviation-edge.com/v2/public/flights"
        params = {"key": ae_key, "flightIata": "LH1327"}
        try:
            resp = await client.get(url, params=params)
            print("\nAviation Edge Live Tracker (LH1327) Response:")
            print(resp.status_code)
            print(resp.json())
        except Exception as e:
            print("AE Tracker LH1327 failed:", e)

        # 3. FlightAware AeroAPI query
        headers = {"x-apikey": fa_key}
        url = "https://aeroapi.flightaware.com/aeroapi/flights/DLH1327"
        try:
            resp = await client.get(url, headers=headers)
            print("\nFlightAware AeroAPI (DLH1327) Response:")
            print(resp.status_code)
            if resp.status_code == 200:
                flights = resp.json().get("flights", [])
                print(f"Found {len(flights)} flights")
                if flights:
                    f = flights[0]
                    print("First flight keys:")
                    print("  ident:", f.get("ident"))
                    print("  status:", f.get("status"))
                    print("  scheduled_out:", f.get("scheduled_out"))
                    print("  scheduled_in:", f.get("scheduled_in"))
                    print("  actual_out:", f.get("actual_out"))
                    print("  actual_in:", f.get("actual_in"))
            else:
                print(resp.text)
        except Exception as e:
            print("FA DLH1327 failed:", e)

        url = "https://aeroapi.flightaware.com/aeroapi/flights/ACA9277"
        try:
            resp = await client.get(url, headers=headers)
            print("\nFlightAware AeroAPI (ACA9277) Response:")
            print(resp.status_code)
            if resp.status_code == 200:
                flights = resp.json().get("flights", [])
                print(f"Found {len(flights)} flights")
            else:
                print(resp.text)
        except Exception as e:
            print("FA ACA9277 failed:", e)

if __name__ == "__main__":
    asyncio.run(main())
