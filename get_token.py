from anime_parsers_ru import KodikParser

parser = KodikParser()
token = parser.get_token()
print(f"\n=== TOKEN: {token} ===\n")