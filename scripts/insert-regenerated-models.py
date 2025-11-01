#!/usr/bin/env python3
import json
import re

# Load the parsed models
with open('regenerated-models-parsed.json', 'r') as f:
    models = json.load(f)

# Load the TypeScript file
with open('lib/readwise-data.ts', 'r') as f:
    content = f.read()

# Find the READWISE_MODELS array
match = re.search(r'export const READWISE_MODELS.*?= \[(.*)\];', content, re.DOTALL)
if not match:
    print("❌ Could not find READWISE_MODELS array")
    exit(1)

models_json_str = '[' + match.group(1) + ']'

# Parse the models JSON
try:
    existing_models = json.loads(models_json_str)
    print(f"✅ Parsed {len(existing_models)} existing models")
except json.JSONDecodeError as e:
    print(f"❌ Failed to parse models JSON: {e}")
    exit(1)

# Add the new models to the existing models list
for new_model in models:
    model_obj = {
        "id": f"{new_model['domainSlug']}-{new_model['code'].lower()}",
        "code": new_model['code'],
        "name": new_model['name'],
        "description": new_model['description'],
        "slug": new_model['slug'],
        "domain": new_model['domain'],
        "domainSlug": new_model['domainSlug'],
        "principles": new_model['principles'],
        "examples": [],
        "applications": new_model['applications'],
        "relatedModels": [],
        "sources": [],
        "tags": [],
        "difficulty": "intermediate",
        "createdAt": "2025-10-31T00:00:00.000Z",
        "updatedAt": "2025-10-31T00:00:00.000Z"
    }
    
    existing_models.append(model_obj)
    print(f"📌 Added {new_model['code']}: {new_model['name']}")

# Convert back to JSON
new_models_json = json.dumps(existing_models, indent=2, ensure_ascii=False)

# Replace in the content
new_content = content.replace(
    match.group(0),
    f"export const READWISE_MODELS: MentalModel[] = {new_models_json};"
)

# Write back
with open('lib/readwise-data.ts', 'w') as f:
    f.write(new_content)

print(f"\n✅ Successfully added {len(models)} models!")
print("Total models now:", len(existing_models))


