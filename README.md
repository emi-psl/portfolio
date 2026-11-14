# portfolio

An animated personal portfolio for **Phyu Sin Lynn (Emi)**, Applied AI & Analytics student at Singapore Polytechnic.
Retro-CRT and paper-letter design: a TV that switches on, a wax-sealed envelope that opens, scrolling star banners and pop-up project cards.

Plain HTML, CSS and JavaScript, with no build step.

## Files

| File | What it does |
|---|---|
| `index.html` | Page structure: hero, letter, about, table of contents, contact |
| `styles.css` | All styling and animations |
| `script.js` | Interactions: marquees, envelope, parallax, tilt, project pop-ups |
| `projects.js` | **Your project list — edit this to add or change projects** |
| `assets/` | Images (put your photo here as `me.jpg`) |

## Add a project

Open `projects.js` and copy any project block inside `PROJECTS`, then change the text.
Set `category` to one of: `ml`, `dl`, `gen`, `data`, `eng`, `dev`.
Add a `repo` link when the project is on GitHub; leave it as `""` to hide the button.
Add an optional `stat` (like `{ value: "94.9%", label: "test accuracy" }`) to show a red badge on the card.

## Section themes

Each project section shares the same building blocks (TV title card, star banner, numbered cards) but has its own look, set in the **Chapter themes** part of `styles.css`:

| Section | Theme |
|---|---|
| 01 Machine Learning | Classic red on cream |
| 02 Deep Learning | Darkroom film strip (scrolls sideways) |
| 03 Generative AI | Cobalt postcards with stamps |
| 04 Data Analytics | Mustard notebook pages |
| 05 Data Engineering | Green blueprint index cards |
| 06 Software & Backend | Terminal windows |

## Add your photo

Save a photo as `assets/me.jpg`. It appears in the polaroid on the About section automatically.

## Run it locally

Open `index.html` in your browser, or in VS Code use the **Live Server** extension.

## Publish with GitHub Pages

1. Push this folder to GitHub.
2. In the repo, go to **Settings → Pages**.
3. Under **Branch**, choose `main` and `/ (root)`, then **Save**.
4. Your site appears at `https://<your-username>.github.io/<repo-name>/` after a minute or two.
