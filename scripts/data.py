# Import required libraries
import ScraperFC as sfc # To access data providers
import json
import time
import os
import random
import pandas as pd

# Initialize variable to access SofaScore
ss = sfc.SofaScore()

# Access a list of dictionaries from the 2025/26 Premier League season
matches = ss.get_match_dicts(year="25/26", league="England Premier League")

# Get a list of dictionaries from the 2025/26 Premier League season
premierLeague = ss.get_match_dicts(year="25/26", league="England Premier League")

# Check the output
print(premierLeague.head(10))

# See if all matchIds are returned
match_ids = [match["id"] for match in premierLeague]
lengthOfMatchIds = len(match_ids)
print(lengthOfMatchIds)

# Deal with NaN values
def clean_value(val):
    if pd.isna(val):
        return None
    return val

JSON_PATH = "./epl_shot_25_26_complete.json"

# Load existing data
if os.path.exists(JSON_PATH):
    with open(JSON_PATH, "r") as f:
        all_shots = json.load(f)
    scraped_ids = {s["match_id"] for s in all_shots}
    print(f"Loaded {len(all_shots)} existing shots from {len(scraped_ids)} matches")
else:
    all_shots = []
    scraped_ids = set()

matches = [m for m in premierLeague if m.get("hasXg")]

for match in matches:
    match_id = match["id"]

    if match_id in scraped_ids:
        print(f"Skipping {match_id}, already scraped")
        continue
    
    home_team = match["homeTeam"]["name"]
    away_team = match["awayTeam"]["name"]

    try:
        df = ss.scrape_match_shots(match_id)

        if df.empty:
            continue

        new_shots = []

        # Loop through all shots
        for _, row in df.iterrows():

            if row.get("shotType") == "own_goal":
                  continue

            draw = row.get("draw", {})
            start = draw.get("start", {})

            if "x" not in start or "y" not in start:
                continue

            x = start["x"] / 100
            y = start["y"] / 100

            # Normalize direction
            if not row["isHome"]:
                y = 1-y
                x = 1-x

            shot_type_raw = clean_value(row.get("shotType", ""))
            result_raw = "Goal" if shot_type_raw == "goal" else shot_type_raw

            shot = {
                 "match_id": match_id,
                 "team": match["homeTeam"]["name"] if row["isHome"] else match["awayTeam"]["name"],
                 "opponent": match["awayTeam"]["name"] if row["isHome"] else match["homeTeam"]["name"],
                 "player": row.get("player", {}).get("name", "Unknown"),
                 "x": clean_value(x),
                 "y": clean_value(y),
                 "shotType": shot_type_raw,   # "miss", "save", "block", "goal"
                 "xg": clean_value(row.get("xg")),
                 "xgot": clean_value(row.get("xgot")),
                 "result": result_raw,         # "Goal" or the shot outcome
                 "minute": row.get("time")
                 }
            
            new_shots.append(shot)

            all_shots.extend(new_shots)

            # Save after every match
            with open(JSON_PATH, "w") as f:
                json.dump(all_shots, f, indent=2)
                
            print(f"{home_team} v {away_team} done - {len(new_shots)} shots added")
            time.sleep(random.randint(3, 5))

    except Exception as e:
        print(f"Failed match {match_id}: {e}")
