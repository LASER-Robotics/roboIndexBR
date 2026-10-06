import requests
import time

def search_authors_by_keyword(keyword, limit=50):
    url = "https://api.semanticscholar.org/graph/v1/paper/search"
    params = {
        "query": keyword,
        "limit": limit,
        "fields": "title,authors"
    }

    response = requests.get(url, params=params)
    found_authors = {}

    if response.status_code == 200:
        data = response.json().get("data", [])
        for paper in data:
            for author in paper.get("authors", []):
                author_id = author.get("authorId")
                name = author.get("name")
                if author_id and name and author_id not in found_authors:
                    found_authors[author_id] = name
    else:
        print("Error:", response.status_code)

    return found_authors

# Usage example
areas = ["robotics", "mechatronics", "electronics"]
for area in areas:
    print(f"\n🔍 Area: {area}")
    authors = search_authors_by_keyword(area, limit=100)
    for author_id, name in list(authors.items())[:10]:  # Shows the first 10
        print(f"{name} -> {author_id}")
    time.sleep(2)
