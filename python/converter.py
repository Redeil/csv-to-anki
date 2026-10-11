import hashlib
import html
import re

import genanki


def _stable_id(value: str) -> int:
    return int(hashlib.sha1(value.encode()).hexdigest()[:8], 16) | (1 << 30)


MODEL = genanki.Model(
    _stable_id("csv-to-anki-basic-model"),
    "CSV Basic (Question/Answer)",
    fields=[{"name": "Question"}, {"name": "Answer"}],
    templates=[{
        "name": "Card 1",
        "qfmt": "{{Question}}",
        "afmt": "{{FrontSide}}<hr id=\"answer\">{{Answer}}",
    }],
    css=".card { font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white; }",
)


def _to_field(value: str) -> str:
    value = html.escape(value.strip())
    return value.replace("\r\n", "\n").replace("\n", "<br>")


def file_name_for(deck_name: str) -> str:
    return (re.sub(r"[^\w\-]+", "_", deck_name).strip("_") or "deck") + ".apkg"


def build_apkg(cards, deck_name: str) -> str:
    """Write an .apkg for (question, answer) pairs and return its path."""
    deck_name = deck_name.strip() or "CSVtoAnki"
    deck = genanki.Deck(_stable_id(deck_name), deck_name)
    for question, answer in cards:
        q, a = _to_field(question), _to_field(answer)
        deck.add_note(genanki.Note(model=MODEL, fields=[q, a], guid=genanki.guid_for(deck_name, q, a)))

    out_path = "/tmp/" + file_name_for(deck_name)
    genanki.Package(deck).write_to_file(out_path)
    return out_path
