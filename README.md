# Kill Team Stream Overlay

Transparent 1920x1080 stream overlay (top bar or bottom bar) that follows a [Kill Team Scorecard](https://thelugger-kt.github.io/kill-team-scorecard/) game in real time.

- `topbar-a.html` - bar along the top
- `topbar-a-bottom.html` - bar along the bottom

Open either page as an OBS Browser Source. With no `game=` in the URL a prompt asks for the scorecard URL (or game id) and optional player names. Press `P` to reopen it. The overlay joins the scorecard's PeerJS room read-only, so both devices just need internet access.

URL parameters: `game`, `player1`, `player2`, plus the scorecard's own `tp`, `initiative`, `leftKill`, ... values as an initial state. `preview=1` shows a sample camera image behind the bar.

Logos: add `assets/logo1.png` and `assets/logo2.png`. Team icons are `assets/icons/<Team name>.png`.
