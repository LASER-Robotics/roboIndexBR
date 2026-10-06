import csv
import time
import requests
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(SCRIPT_DIR)

# Searches Semantic Scholar for papers, filtering by university and topic
def search_articles_by_university_and_topic(university_acronym, topic_keywords, start_year=2020, end_year=2025, max_results=100):
    url = "https://api.semanticscholar.org/graph/v1/paper/search"
    query = f"{university_acronym} {' '.join(topic_keywords)}"  # Combines the university with the topic keywords
    params = {
        'query': query,
        'limit': max_results,
        'fields': 'title,authors,paperId,year,venue'
    }
    
    articles = []
    try:
        # Makes the request to the Semantic Scholar API
        response = requests.get(url, params=params)
        
        # Checks the response code
        if response.status_code == 200:
            data = response.json()
            for paper in data.get('data', []):
                # Checks that the year is present and is a valid number
                year = paper.get('year', None)
                if year is None:
                    year = 0  # Default value if the year is missing

                # Filters the papers within the year range
                if start_year <= int(year) <= end_year:
                    # Processes the authors, if it is a list or dictionary
                    if isinstance(paper.get('authors', []), list):
                        authors = ', '.join([author['name'] for author in paper['authors']]) if 'authors' in paper else 'N/A'
                    else:
                        authors = 'N/A'  # If it is not a valid author list
                    
                    articles.append({
                        'title': paper['title'],
                        'authors': authors,
                        'year': year,
                        'university': university_acronym,
                        'venue': paper.get('venue', 'N/A'),
                        'url': f"https://semanticscholar.org/paper/{paper['paperId']}"
                    })
        elif response.status_code == 429:
            # If the request limit is hit (429), waits 1 minute and tries again
            print(f"Request limit reached for university {university_acronym}. Waiting 60 seconds...")
            time.sleep(60)  # 1-minute delay
            return search_articles_by_university_and_topic(university_acronym, topic_keywords, start_year, end_year, max_results)
        else:
            print(f"Request error for {university_acronym}: {response.status_code}")
            return []
    except Exception as e:
        print(f"Request error for {university_acronym}: {e}")
        return []
    
    return articles

# Reads the Brazilian universities from a CSV file
def read_universities_csv(file_path):
    universities = []
    with open(file_path, mode='r', encoding='utf-8') as file:
        reader = csv.reader(file)
        next(reader)  # Skips the header
        for row in reader:
            universities.append(row[1])  # Assumes the acronym is in the second column
    return universities

# Saves the papers found to a CSV file
def save_articles_to_csv(articles, output_file):
    # Defines the CSV fields
    fieldnames = ['title', 'authors', 'year', 'university', 'venue', 'url']
    
    # Writes the data to the CSV file
    with open(output_file, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for article in articles:
            writer.writerow(article)

# Main function
def main():
    # Path to the CSV file with the acronyms of the Brazilian universities
    universities_csv = 'universities.csv'  # Replace with the real path of your CSV
    output_csv = 'brazilian_papers_2020_2025.csv'  # Output file path

    # Reads the universities from the CSV
    universities = read_universities_csv(universities_csv)

    # Defines the keywords of the topic "Mechanical Design and Mechatronics"
    topic_keywords = ["Mechanical Design", "Mechatronics"]

    # List to store all the papers found
    all_articles = []

    # Searches Semantic Scholar for each university's papers
    for university in universities:
        print(f"Searching papers for university {university}...")
        articles = search_articles_by_university_and_topic(university, topic_keywords, start_year=2020, end_year=2025)
        all_articles.extend(articles)

    # Saves the papers to the CSV file
    save_articles_to_csv(all_articles, output_csv)
    print(f"Papers saved to file {output_csv}")

# Runs the script
if __name__ == '__main__':
    main()
