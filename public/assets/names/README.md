# Name clips for the TV summons

When a mini-game summons players to the TV, the TV calls the ones who haven't tapped **I'M HERE** by name:
1.6 seconds after the alarm, then every 20 seconds until they're all in. It plays each name's clip in turn,
then a closing **"To the TV. Now."** Any name without a clip is said by the computer voice instead, in the
same sequence, so a missing file never breaks anything.

The clips are **yours**: you supply them, and you are responsible for them. They are for private use at
the party only. Don't commit clips you don't have the rights to share to a public repo.

## 1. Make the clip

- **Format:** `.mp3` (works everywhere). `.ogg` also works in Chrome/Edge/Firefox but **not Safari**.
- **Mono**, **0.5 to 3 seconds**: just the name, a little silence either side at most. Anything over
  3.5 seconds is cut off (with a short fade).
- **Normalised loudness**, so no name is much louder than the rest.

Trim a clip out of a video or audio file with ffmpeg (START and END in seconds, or `00:01:23.4`):

```
ffmpeg -ss START -to END -i in.mp4 -vn -ac 1 -b:a 96k name.mp3
```

Trim and normalise the loudness in one go (do this for every clip so they all match):

```
ffmpeg -ss START -to END -i in.mp4 -vn -ac 1 -af loudnorm=I=-16:TP=-1.5:LRA=11 -b:a 96k name.mp3
```

Already have a clip and just want to normalise it:

```
ffmpeg -i harry-raw.mp3 -ac 1 -af loudnorm=I=-16:TP=-1.5:LRA=11 -b:a 96k harry.mp3
```

## 2. Name the file

Drop it in this folder (`public/assets/names/`) with the filename the manifest expects. These are already
listed in `manifest.json`:

| Name | File | Also matches |
|---|---|---|
| Aaron | `aaron.mp3` | |
| Harry | `harry.mp3` | |
| Aidan | `aidan.mp3` | |
| Sol | `sol.mp3` | |
| Joshua | `joshua.mp3` | Josh |
| Jamie | `jamie.mp3` | |
| Kyle | `kyle.mp3` | |
| James | `james.mp3` | Jim |
| Jimmy | `jimmy.mp3` | |
| Beth | `beth.mp3` | Bethany, Elizabeth |
| Emma | `emma.mp3` | |
| Matthew | `matthew.mp3` | Matt |
| Thomas | `thomas.mp3` | Tom, Tommy |
| Munro | `munro.mp3` | |
| Jenkins | `jenkins.mp3` | |
| Luke | `luke.mp3` | |
| Eva | `eva.mp3` | |
| *(closing line)* | `to-the-tv.mp3` | optional: replaces the spoken "To the TV. Now." |

Any file that isn't there is skipped, so add them one at a time.

## 3. The manifest (`manifest.json`)

Each entry is a first name (lower case) with its clips and, optionally, other names that should use them:

```json
{
  "harry":   { "files": ["harry.mp3"], "aliases": ["haz", "harrison"] },
  "thomas":  { "files": ["thomas.mp3", "thomas-2.mp3"], "aliases": ["tom", "tommy"] },
  "jenkins": { "files": [{ "file": "jenkins-full.mp3", "start": 1.2, "end": 2.6, "gain": 0.8 }] }
}
```

- **More than one file:** one is picked at random each time, for variety.
- **`start` / `end`** (seconds): play just that part of the file, so you don't even have to trim it.
- **`gain`**: volume for that clip (1 = as is, 0.5 = half, 1.5 = louder). Use it if one clip still stands out.
- **Aliases:** add a name to `aliases` and players with that name use the same clip (e.g. "Josh" → joshua).
  A name that has its own entry always wins over someone else's alias (Jimmy is its own entry, not an
  alias of James).
- **`_stinger`**: the clip for the closing line. Leave it out (or leave the file missing) to use the voice.

## How names are matched

Matching ignores case, accents and punctuation ("O'Brien" → `obrien`, "Zoë" → `zoe`). For a player's display
name the TV tries, in order, the **first word**, then the **whole name** run together, then **each other
word**, each as a name or an alias. So:

- "Harry" and "Harry M" → `harry`
- "James Munro" → `james` if there's a James clip, otherwise `munro`
- "Munro" on its own → `munro`

The first match that has a clip on disk wins; if none do, the voice says the player's display name.

## Testing

Test Lab (TV main menu) → **Summons** plays a summons for three pretend names. With the TV's sound off,
nothing plays.
