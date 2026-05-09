import zipfile
import re

z = zipfile.ZipFile(r'C:\Users\chira\Downloads\QuizLive_Design_Document.docx')
content = z.read('word/document.xml').decode('utf-8')

# Remove XML tags to extract readable text
text = re.sub(r'<[^>]+>', '', content)
# Clean up whitespace
text = re.sub(r'\s+', ' ', text)

with open(r'd:\quiz\design.txt', 'w', encoding='utf-8') as f:
    f.write(text)
    
print("✓ Design document extracted")
print("\nContent preview:")
print(text[:2000])
