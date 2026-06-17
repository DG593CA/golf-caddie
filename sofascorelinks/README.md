# SofaScore Link Builder

A high-performance, responsive Single Page Application (SPA) dashboard designed to generate, customize, and validate attribution and deep links for SofaScore marketing campaigns.

## Key Features

1. **Preset Market Handling**:
   - **Launch Markets Preset**: Automatically selects the 10 initial launch markets: **AR, UK, FR, ES, CA, PT, GH, CIV (Cote d'Ivoire), ID, MX** with a click lookback window of **100 days** (`100d`).
   - **Sensitive Markets Protection**: USA (`US`) and Brazil (`BR`) are sensitive markets and are hidden/held-off by default. Toggle "Sensitive US/BR" to reveal them, marked with distinctive warning badges.
   
2. **Dynamic Link Engine**:
   - Compiles full tracking parameters with custom Publisher ID (`af_channel`) and Media Source (`pid`).
   - Automatically injects the correct market code into the campaign parameter `c` (e.g. `CP_GWM_UK_15odds_impressions`).
   - Pass back payout rates (`af_cost_value`) and currencies (`af_cost_currency`) automatically.
   
3. **Interactive Control Center**:
   - **Inline Customization**: Edit payout values, campaign codes, and click lookback windows directly inside the table row to immediately regenerate the link.
   - **Interactive Table View**: Sleek grid layout showing all data fields with copy and testing controls.
   - **Detailed Cards**: A visually detailed breakdown card for each market.
   - **Raw Text Area**: Quick access to copy all generated URLs.
   - **Search & Filters**: Search countries by name or ISO code.
   - **Export CSV**: Download a spreadsheet layout of all selected links and details.
   - **Copy-to-Clipboard**: Global and individual copy operations with dynamic success toast notifications.
   - **Automated Sanity Checker**: Programmatic validator checking for structural consistency across generated URLs.

## Project Structure

- `index.html` - Semantic markup, layout structure, and SEO elements.
- `styles.css` - Custom obsidian dark theme, glassmorphism, responsive styles, and notification keyframes.
- `app.js` - Data model, state management, parameter assembly logic, CSV generator, and validation testing suite.

## How to Run Locally

You can launch and test the dashboard immediately using any local web server. For example:

### Python 3 Server
Run the following in the terminal:
```bash
python3 -m http.server 8000
```
Then open your browser to `http://localhost:8000`.

### Node.js (http-server)
Run the following in the terminal:
```bash
npx http-server -p 8000
```
Then open your browser to `http://localhost:8000`.

## Deployment

Since this dashboard has zero compile step and requires no backend, it can be deployed for free on various static hosting platforms:
- **GitHub Pages**: Push this directory to a GitHub repo and enable Pages.
- **Vercel / Netlify**: Connect your git repository for automatic builds.
